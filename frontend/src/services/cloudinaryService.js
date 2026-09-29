// src/services/cloudinaryService.js

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const validateImage = (file) => {
  if (!file) return { valid: false, error: 'No file selected' };
  
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }
  
  // 5MB limit
  const MAX_SIZE_MB = 5;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `Image must be under ${MAX_SIZE_MB}MB` };
  }
  
  return { valid: true };
};

export const uploadImage = async (file) => {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary environment variables are missing');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to upload image');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

export const getOptimizedUrl = (cloudinaryUrl) => {
  if (!cloudinaryUrl) return null;
  // Cloudinary standard transformations: auto format, auto quality, crop fill to 400x400
  // e.g. https://res.cloudinary.com/demo/image/upload/v12345/sample.jpg 
  // becomes https://res.cloudinary.com/demo/image/upload/w_400,h_400,c_fill,q_auto,f_auto/v12345/sample.jpg
  return cloudinaryUrl.replace('/upload/', '/upload/w_400,h_400,c_fill,q_auto,f_auto/');
};
