'use client'

import { useState, useRef, useEffect } from 'react'
import { Building2, Camera, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Image from 'next/image'

type SupplierLogoUploadProps = {
  value: string | null
  onChange: (url: string | null) => void
  companyId: string
}

export function SupplierLogoUpload({ value, onChange, companyId }: SupplierLogoUploadProps) {
  const { t } = useI18n()
  const supabase = createClient()
  const [isUploading, setIsUploading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getUserId()
  }, [supabase])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error(t('supplierProfile.logoInvalidFileType'))
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('supplierProfile.logoTooLarge'))
      return
    }

    let resolvedUserId = userId
    if (!resolvedUserId) {
      const { data: { user } } = await supabase.auth.getUser()
      resolvedUserId = user?.id ?? null
      if (resolvedUserId) setUserId(resolvedUserId)
    }
    if (!resolvedUserId) {
      toast.error(t('supplierProfile.logoUploadError'))
      return
    }

    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop() || 'png'
      const filePath = `${resolvedUserId}/${companyId}/logo.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(filePath)

      onChange(urlData.publicUrl)
      toast.success(t('supplierProfile.logoUploaded'))
    } catch (error) {
      const e = error as { message?: string; statusCode?: string }
      console.error('Error uploading logo:', e?.message ?? error, e)
      toast.error(t('supplierProfile.logoUploadError'))
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    onChange(null)
    toast.success(t('supplierProfile.logoRemoved'))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted/30">
          {value ? (
            <Image
              src={value}
              alt={t('supplierProfile.logoCurrentAlt')}
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
              <Building2 className="h-10 w-10" />
            </div>
          )}
          
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="mr-2 h-3.5 w-3.5" />
              {value ? t('supplierProfile.changeLogo') : t('supplierProfile.uploadLogo')}
            </Button>
            
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isUploading}
                onClick={handleRemove}
              >
                <X className="mr-2 h-3.5 w-3.5" />
                {t('supplierProfile.removeLogo')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('supplierProfile.logoHint')}
          </p>
        </div>
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleUpload}
      />
    </div>
  )
}
