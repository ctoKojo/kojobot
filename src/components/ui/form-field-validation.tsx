import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertCircle, Check } from 'lucide-react';

interface FormFieldWithValidationProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  type?: string;
  placeholder?: string;
  dir?: 'ltr' | 'rtl';
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  showSuccess?: boolean;
}

export function FormFieldWithValidation({
  label,
  id,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  dir,
  required = false,
  disabled = false,
  maxLength,
  className,
  showSuccess = false,
}: FormFieldWithValidationProps) {
  const hasValue = value && value.trim() !== '';
  const showSuccessIndicator = showSuccess && hasValue && !error;

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id} className={cn(error && 'text-destructive')}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={dir}
          disabled={disabled}
          maxLength={maxLength}
          className={cn(
            error && 'border-destructive focus-visible:ring-destructive',
            showSuccessIndicator && 'border-green-500 focus-visible:ring-green-500',
            (error || showSuccessIndicator) && 'pr-10'
          )}
        />
        {error && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
        )}
        {showSuccessIndicator && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          {error}
        </p>
      )}
    </div>
  );
}

interface PasswordRequirement {
  met: boolean;
  label: string;
}

interface PasswordFieldWithRequirementsProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  requirements: PasswordRequirement[];
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

export function PasswordFieldWithRequirements({
  label,
  id,
  value,
  onChange,
  requirements,
  disabled = false,
  required = false,
  placeholder,
}: PasswordFieldWithRequirementsProps) {
  const allMet = requirements.every((r) => r.met);
  const hasValue = value && value.length > 0;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          hasValue && !allMet && 'border-destructive focus-visible:ring-destructive',
          hasValue && allMet && 'border-green-500 focus-visible:ring-green-500'
        )}
      />
      {hasValue && (
        <div className="space-y-1">
          {requirements.map((req, index) => (
            <p
              key={index}
              className={cn(
                'text-xs flex items-center gap-1.5 transition-colors',
                req.met ? 'text-green-600' : 'text-muted-foreground'
              )}
            >
              {req.met ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="h-3 w-3 rounded-full border border-current flex-shrink-0" />
              )}
              {req.label}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
