import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { ImageCropDialog } from '@/components/ImageCropDialog';

interface AvatarUploadProps {
  currentUrl?: string | null;
  name: string;
  onFileSelect: (file: File) => void;
  onRemove?: () => void;
  previewUrl?: string | null;
  uploading?: boolean;
  size?: 'sm' | 'lg';
}

export function AvatarUpload({ 
  currentUrl, 
  name, 
  onFileSelect, 
  onRemove,
  previewUrl,
  uploading = false,
  size = 'lg'
}: AvatarUploadProps) {
  const { isRTL } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const sizeClass = size === 'lg' ? 'h-20 w-20' : 'h-14 w-14';
  const iconSize = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  const displayUrl = previewUrl || currentUrl;

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار صورة صالحة' : 'Please select a valid image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image must be less than 5MB');
      return;
    }

    // Open crop dialog instead of directly selecting
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = (croppedFile: File) => {
    onFileSelect(croppedFile);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleCropClose = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <div className="relative group">
          <Avatar className={`${sizeClass}`}>
            <AvatarImage src={displayUrl || undefined} />
            <AvatarFallback className="text-sm bg-primary text-primary-foreground">
              {initials || '??'}
            </AvatarFallback>
          </Avatar>

          <button
            type="button"
            onClick={handleClick}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Loader2 className={`${iconSize} text-white animate-spin`} />
            ) : (
              <Camera className={`${iconSize} text-white`} />
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {(previewUrl || currentUrl) && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-xs text-destructive hover:text-destructive h-auto py-1"
          >
            <X className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
            {isRTL ? 'إزالة الصورة' : 'Remove'}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          {isRTL ? 'اضغط لاختيار صورة' : 'Click to select photo'}
        </p>
      </div>

      {cropSrc && (
        <ImageCropDialog
          open={!!cropSrc}
          imageSrc={cropSrc}
          onClose={handleCropClose}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  );
}
