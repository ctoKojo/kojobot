import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QuestionImageUploadProps {
  imageUrl?: string;
  onImageChange: (url: string | null) => void;
  isRTL: boolean;
}

export function QuestionImageUpload({ imageUrl, onImageChange, isRTL }: QuestionImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'يرجى اختيار ملف صورة' : 'Please select an image file',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image size must be less than 5MB',
      });
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `questions/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('quiz-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('quiz-images')
        .getPublicUrl(filePath);

      onImageChange(publicUrl);

      toast({
        title: isRTL ? 'تم الرفع' : 'Uploaded',
        description: isRTL ? 'تم رفع الصورة بنجاح' : 'Image uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في رفع الصورة' : 'Failed to upload image',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async () => {
    if (!imageUrl) return;

    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/quiz-images/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('quiz-images').remove([filePath]);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }

    onImageChange(null);
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {imageUrl ? (
        <div className="relative inline-block">
          <img
            src={imageUrl}
            alt="Question"
            className="max-h-48 rounded-lg border object-contain"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleRemoveImage}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          {isRTL ? 'رفع صورة' : 'Upload Image'}
        </Button>
      )}
    </div>
  );
}
