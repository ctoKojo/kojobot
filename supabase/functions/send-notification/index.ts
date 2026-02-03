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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!authHeader) {
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

    // Use service role client to insert notifications
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
