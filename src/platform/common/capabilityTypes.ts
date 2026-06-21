export type PlatformCapability =
  | 'file.open'
  | 'file.save'
  | 'folder.open'
  | 'folder.tree'
  | 'image.pick'
  | 'image.copyToAssets'
  | 'image.importBytesToAssets'
  | 'image.downloadToAssets'
  | 'pdf.save'
  | 'metadata.sqlite'
  | 'externalFile.open'
  | 'window.chrome'
  | 'native.menu';
