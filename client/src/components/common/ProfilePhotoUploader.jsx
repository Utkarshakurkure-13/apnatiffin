import React, { useState, useRef } from 'react';
import { Camera, Upload, CheckCircle2, AlertCircle, Loader2, User, ChefHat, ShieldAlert, RefreshCw } from 'lucide-react';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export default function ProfilePhotoUploader({
  currentPhoto = null,
  uploadEndpoint = '/api/customer/profile/photo',
  onPhotoUploaded,
  role = 'CUSTOMER',
  fallbackName = '',
  title = 'Profile Photo',
  subtitle = 'Upload a high-resolution JPG, PNG or WebP photo (Max 5MB).'
}) {
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const fileInputRef = useRef(null);

  // Pick default icon & theme based on role
  const getRoleBadge = () => {
    if (role === 'ADMIN') {
      return {
        bg: 'bg-slate-900 text-emerald-400 border-slate-700',
        icon: <ShieldAlert className="w-10 h-10" />
      };
    }
    if (role === 'PROVIDER') {
      return {
        bg: 'bg-gradient-to-br from-amber-600 to-amber-800 text-white border-amber-500/30',
        icon: <ChefHat className="w-10 h-10" />
      };
    }
    return {
      bg: 'bg-[#2d6a4f] text-white border-[#2d6a4f]/30',
      icon: <User className="w-10 h-10" />
    };
  };

  const handleFileChange = (e) => {
    setStatus({ type: '', message: '' });
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setStatus({
        type: 'error',
        message: 'Invalid file type. Only JPG, JPEG, PNG, and WEBP formats are supported.'
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setStatus({
        type: 'error',
        message: `File exceeds the ${MAX_FILE_SIZE_MB}MB size limit. Please choose a smaller image.`
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatus({ type: 'error', message: 'Please select a photo first.' });
      return;
    }

    setUploading(true);
    setStatus({ type: '', message: '' });

    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      if (!token) {
        throw new Error('Authentication required. Please log in first.');
      }

      const formData = new FormData();
      formData.append('photo', selectedFile);

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
        throw new Error(text.length < 150 ? text : `Server error (${res.status} ${res.statusText}). Please verify server is running.`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload profile photo.');
      }

      setStatus({
        type: 'success',
        message: data.message || 'Profile photo saved successfully!'
      });
      setSelectedFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (onPhotoUploaded) {
        onPhotoUploaded(data.photo_url, data);
      }
    } catch (err) {
      console.error('Profile photo upload error:', err);
      setStatus({
        type: 'error',
        message: err.message || 'Failed to upload photo. Please try again.'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancelSelected = () => {
    setSelectedFile(null);
    setPreview(null);
    setStatus({ type: '', message: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const displayPhoto = preview || currentPhoto;
  const roleBadge = getRoleBadge();
  const initial = (fallbackName || 'U').charAt(0).toUpperCase();

  return (
    <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-black/5 shadow-md space-y-4 bg-white/90">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-heading font-bold text-base sm:text-lg text-[#181a2e] flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#2d6a4f]" />
            <span>{title}</span>
          </h3>
          <p className="text-xs text-[#707973] mt-0.5">{subtitle}</p>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          id={`profile-photo-input-${role.toLowerCase()}`}
        />

        {/* Upload / Change Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-xl bg-white hover:bg-emerald-50 text-[#0f5238] border border-[#2d6a4f]/30 text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            <span>{displayPhoto ? 'Change Photo' : 'Choose Photo'}</span>
          </button>

          {selectedFile && (
            <>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 rounded-xl bg-[#2d6a4f] hover:bg-[#1b4332] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Save Photo</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancelSelected}
                disabled={uploading}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#404943] text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Avatar Display Card & Guidelines */}
      <div className="flex flex-col sm:flex-row items-center gap-5 pt-2 border-t border-black/5">
        {/* Avatar Container */}
        <div className="relative group shrink-0">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden border-2 border-black/10 shadow-lg flex items-center justify-center bg-gray-50">
            {displayPhoto ? (
              <img
                src={displayPhoto}
                alt="Profile Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className={`w-full h-full flex flex-col items-center justify-center font-black text-3xl shadow-inner ${roleBadge.bg}`}>
                {fallbackName ? (
                  <span>{initial}</span>
                ) : (
                  roleBadge.icon
                )}
              </div>
            )}
          </div>

          {/* Overlay Quick-Edit Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Click to change photo"
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#2d6a4f] text-white flex items-center justify-center shadow-md hover:bg-[#1b4332] transition-transform hover:scale-110 cursor-pointer border-2 border-white"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Details & Specs */}
        <div className="flex-1 text-center sm:text-left space-y-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="text-xs font-bold text-[#181a2e]">
              {selectedFile ? 'Ready to upload:' : (currentPhoto ? 'Current Active Photo' : 'No photo uploaded')}
            </span>
            {selectedFile && (
              <span className="badge-pill bg-amber-100 text-amber-900 text-[10px] font-bold">
                Unsaved Preview
              </span>
            )}
          </div>

          {selectedFile ? (
            <p className="text-xs text-[#2d6a4f] font-semibold truncate max-w-md">
              {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
          ) : (
            <p className="text-xs text-[#707973]">
              Formats accepted: <span className="font-semibold text-[#181a2e]">JPG, JPEG, PNG, WEBP</span>. Maximum file size: <span className="font-semibold text-[#181a2e]">5 MB</span>.
            </p>
          )}

          <p className="text-[11px] text-[#707973] italic">
            A clear square or portrait photo helps other users and platform admins identify your account easily.
          </p>
        </div>
      </div>

      {/* Feedback Alerts */}
      {status.message && (
        <div
          className={`p-3 rounded-2xl flex items-center justify-between text-xs font-semibold ${
            status.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {status.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatus({ type: '', message: '' })}
            className="font-bold opacity-60 hover:opacity-100 cursor-pointer ml-2"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
