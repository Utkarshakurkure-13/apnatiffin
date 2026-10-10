import React, { useState, useRef } from 'react';
import { Camera, Loader2, User, ChefHat, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Compact circular profile photo uploader component
 */
export default function ProfilePhotoUploader({
  currentPhoto = null,
  uploadEndpoint = '/api/customer/profile/photo',
  onPhotoUploaded,
  role = 'CUSTOMER',
  fallbackName = '',
  size = 'md', // 'sm' (16), 'md' (20), 'lg' (24)
  showChangeButton = true
}) {
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  const getRoleIcon = () => {
    if (role === 'ADMIN') return <ShieldAlert className="w-8 h-8 text-emerald-400" />;
    if (role === 'PROVIDER') return <ChefHat className="w-8 h-8 text-white" />;
    return <User className="w-8 h-8 text-white" />;
  };

  const getRoleBg = () => {
    if (role === 'ADMIN') return 'bg-slate-900 border-slate-700';
    if (role === 'PROVIDER') return 'bg-gradient-to-br from-amber-600 to-amber-800 border-amber-500/30';
    return 'bg-[#2d6a4f] border-[#2d6a4f]/30';
  };

  const sizeClasses = {
    sm: 'w-16 h-16 text-xl',
    md: 'w-20 h-20 sm:w-22 sm:h-22 text-2xl',
    lg: 'w-24 h-24 sm:w-28 sm:h-28 text-3xl'
  }[size] || 'w-20 h-20 text-2xl';

  const cameraBtnSize = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7 sm:w-8 sm:h-8';
  const cameraIconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5 sm:w-4 sm:h-4';

  const handleFileChange = async (e) => {
    setErrorMsg('');
    setSuccessMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setErrorMsg('Invalid format. Only JPG, JPEG, PNG, and WebP are supported.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate size (5MB max)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(`Image exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Immediate preview & direct auto-upload to S3
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      if (!token) {
        throw new Error('Authentication required.');
      }

      const formData = new FormData();
      formData.append('photo', file);

      const res = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.length < 150 ? text : `Upload failed (${res.status}).`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload photo.');
      }

      const newPhotoUrl = data.photo_url || localUrl;
      setPreview(newPhotoUrl);
      setSuccessMsg(data.message || 'Photo uploaded to S3 successfully!');
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });

      if (onPhotoUploaded) {
        onPhotoUploaded(newPhotoUrl, data);
      }

      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('[PHOTO UPLOAD ERROR]', err);
      setErrorMsg(err.message || 'Failed to upload photo.');
      setPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const displayPhoto = preview || currentPhoto;
  const initial = (fallbackName || 'U').charAt(0).toUpperCase();

  return (
    <div className="flex flex-col items-center sm:items-start gap-1">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        id={`compact-avatar-input-${role.toLowerCase()}`}
        disabled={uploading}
      />

      {/* Circular Avatar Container with Camera Button */}
      <div className="relative group shrink-0">
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          title="Click to change profile picture"
          className={`${sizeClasses} rounded-full overflow-hidden border-2 border-white shadow-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-105 relative bg-gray-100 ring-2 ring-black/10`}
        >
          {displayPhoto ? (
            <img
              src={displayPhoto}
              alt={fallbackName || 'Profile Photo'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center font-black text-white ${getRoleBg()}`}>
              {fallbackName ? initial : getRoleIcon()}
            </div>
          )}

          {/* Uploading Spinner Overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white z-10">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Saving</span>
            </div>
          )}
        </div>

        {/* Small Camera Icon Overlay Badge */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!uploading) fileInputRef.current?.click();
          }}
          disabled={uploading}
          title="Change photo"
          aria-label="Upload new profile picture"
          className={`absolute bottom-0 right-0 ${cameraBtnSize} rounded-full bg-[#2d6a4f] hover:bg-[#1b4332] text-white flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-115 cursor-pointer disabled:opacity-50`}
        >
          {uploading ? (
            <Loader2 className={`${cameraIconSize} animate-spin`} />
          ) : (
            <Camera className={cameraIconSize} />
          )}
        </button>
      </div>

      {/* Optional Compact Change Photo Link */}
      {showChangeButton && (
        <button
          type="button"
          onClick={() => !uploading && fileInputRef.current?.click()}
          disabled={uploading}
          className="text-[11px] text-[#2d6a4f] hover:text-[#1b4332] hover:underline font-bold flex items-center gap-1 mt-1 cursor-pointer disabled:opacity-50"
        >
          <Camera className="w-3 h-3" />
          <span>{uploading ? 'Uploading...' : 'Change Photo'}</span>
        </button>
      )}

      {/* Compact Status Messages */}
      {successMsg && (
        <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-1 animate-in fade-in">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>{successMsg}</span>
        </p>
      )}

      {errorMsg && (
        <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1 animate-in fade-in">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{errorMsg}</span>
        </p>
      )}
    </div>
  );
}
