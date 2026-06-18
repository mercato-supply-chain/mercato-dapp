export function getPathFromUrl(url: string): string | null {
  const marker = '/storage/v1/object/public/products/'
  const index = url.indexOf(marker)
  if (index !== -1) {
    return decodeURIComponent(url.substring(index + marker.length))
  }
  return null
}

export async function deleteStorageFile(
  supabase: { storage: { from: (bucket: string) => { remove: (paths: string[]) => Promise<{ error: unknown }> } } },
  url: string,
): Promise<void> {
  const path = getPathFromUrl(url)
  if (path) {
    const { error } = await supabase.storage.from('products').remove([path])
    if (error) {
      console.error('Error deleting file from storage:', error)
    }
  }
}
