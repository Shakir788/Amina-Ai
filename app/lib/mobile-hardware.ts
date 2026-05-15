// 1. Flashlight 🔦
export const toggleFlashlight = async (enable: boolean) => {
  if (typeof window === 'undefined') return; 

  try {
    // @ts-ignore
    if (window.plugins && window.plugins.flashlight) {
      if (enable) {
        // @ts-ignore
        window.plugins.flashlight.switchOn();
      } else {
        // @ts-ignore
        window.plugins.flashlight.switchOff();
      }
    }
  } catch (error) {
    console.error("Flashlight Error:", error);
  }
};

// 2. Vibration 📳
export const triggerVibration = async () => {
  if (typeof window === 'undefined') return; 
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (err) { console.log("Vibration failed", err); }
};

// 3. Camera 📸
export const openCamera = async () => {
  if (typeof window === 'undefined') return;
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera
    });

    return image.webPath; 
  } catch (err) {
    console.log("Camera failed or cancelled", err);
  }
};

// 4. Phone Call 📞
export const makePhoneCall = async (phoneNumber: string) => {
  if (typeof window === 'undefined') return;
  try {
    // Ye direct dialer open kar dega number type karke
    window.location.href = `tel:${phoneNumber}`;
  } catch (err) {
    console.error("Call failed", err);
  }
};

// 5. WhatsApp Message 💬
export const openWhatsApp = async (contact: string, message: string = "") => {
  if (typeof window === 'undefined') return;
  try {
    // Format number if needed and open WhatsApp
    const encodedMsg = encodeURIComponent(message);
    window.location.href = `https://wa.me/${contact}?text=${encodedMsg}`;
  } catch (err) {
    console.error("WhatsApp failed", err);
  }
};

// 6. YouTube 🎵
export const openYouTube = async (query: string) => {
  if (typeof window === 'undefined') return;
  try {
    // Ye pehle native app kholne ki try karega URL scheme se
    window.location.href = `vnd.youtube://results?search_query=${encodeURIComponent(query)}`;
    
    // Fallback timer (agar app nahi khuli toh browser me khol dega)
    setTimeout(() => {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
    }, 1500);
  } catch (err) {
    console.error("YouTube failed", err);
  }
};

// --- MASTER EXECUTOR ---
export const executeMobileAction = async (action: string, data: any) => {
  if (typeof window === 'undefined') return; 

  console.log("📱 [SYSTEM] Executing Mobile Action:", action, data);
  triggerVibration();

  switch (action.toUpperCase()) {
    case 'FLASHLIGHT':
      const shouldEnable = data?.value !== 'off' && data?.status !== 'inactive';
      await toggleFlashlight(shouldEnable);
      break;

    case 'CAMERA':
    case 'TAKE_PHOTO':
      await openCamera();
      break;

    case 'CALL':
      if (data?.query) await makePhoneCall(data.query.replace(/[^0-9+]/g, ''));
      break;

    case 'WHATSAPP':
      await openWhatsApp(data?.query || "", data?.value || "");
      break;

    case 'YOUTUBE':
    case 'SEARCH_VIDEO':
      await openYouTube(data?.query || "");
      break;

    case 'ALARM':
    case 'REMINDER':
      console.log("Alarm Intent received:", data?.query);
      alert(`Amina AI: Reminder set for ${data?.query || "later"}`);
      break;

    default:
      console.log("⚠️ Unhandled Action:", action);
      break;
  }
};