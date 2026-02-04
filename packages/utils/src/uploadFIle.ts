export const createUploadImageHandler =
  (onUploadImage: (base64: string) => void) => (file: any) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.addEventListener('load', () => {
      onUploadImage(String(reader.result));
    });
    // Return false to prevent Ant Design Upload from POSTing the file to the current page URL
    return false;
  };
