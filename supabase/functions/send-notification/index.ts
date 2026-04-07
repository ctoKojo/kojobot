import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit config: 30 notifications per minute per IP
const RATE_LIMIT_CONFIG = { maxRequests: 30, windowMs: 60000 };

interface NotificationPayload {
  user_id?: string;
  group_id?: string;
  title: string;
  title_ar: string;
  message: string;
  message_ar: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  action_url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Apply rate limiting
    const clientIP = getClientIP(req);
    const rateLimitResult = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for send-notification from IP: ${clientIP}`);
      return rateLimitResponse(rateLimitResult, corsHeaders);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the user's token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user role
    const { data: roleData } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || (roleData.role !== 'admin' && roleData.role !== 'instructor')) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only admins and instructors can send notifications' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For instructors, restrict to their own group students only
    const isInstructor = roleData.role === 'instructor';

    // Use service role client to insert notifications
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();

    // Validate required fields
    if (!payload.title || !payload.title_ar || !payload.message || !payload.message_ar) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title, title_ar, message, message_ar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate lengths
    if (payload.title.length > 500 || payload.title_ar.length > 500 || payload.message.length > 2000 || payload.message_ar.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Title must be under 500 chars, message under 2000 chars' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format for user_id/group_id if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (payload.user_id && !uuidRegex.test(payload.user_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (payload.group_id && !uuidRegex.test(payload.group_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid group_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.user_id && !payload.group_id) {
      return new Response(
        JSON.stringify({ error: 'Either user_id or group_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate type if provided
    const validTypes = ['info', 'success', 'warning', 'error'];
    if (payload.type && !validTypes.includes(payload.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be one of: info, success, warning, error' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notifications: any[] = [];

    if (payload.user_id) {
      // Single user notification
      notifications.push({
        user_id: payload.user_id,
        title: payload.title,
        title_ar: payload.title_ar,
        message: payload.message,
        message_ar: payload.message_ar,
        type: payload.type || 'info',
        category: payload.category || 'general',
        action_url: payload.action_url,
      });
    } else if (payload.group_id) {
      // Group notification - get all students in the group
      const { data: students, error: studentsError } = await serviceClient
        .from('group_students')
        .select('student_id')
        .eq('group_id', payload.group_id)
        .eq('is_active', true);

      if (studentsError) {
        throw studentsError;
      }

      if (students && students.length > 0) {
        for (const student of students) {
          notifications.push({
            user_id: student.student_id,
            title: payload.title,
            title_ar: payload.title_ar,
            message: payload.message,
            message_ar: payload.message_ar,
            type: payload.type || 'info',
            category: payload.category || 'general',
            action_url: payload.action_url,
          });
        }
      }
    }

    if (notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No notifications to send' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: insertError } = await serviceClient
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      throw insertError;
    }

    console.log(`Sent ${notifications.length} notifications`);

    return new Response(
      JSON.stringify({ success: true, count: notifications.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
