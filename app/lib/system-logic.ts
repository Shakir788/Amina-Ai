// --- BRAIN ONLY (No Hardware Imports) ---
// Ye file Server pe chalegi, isliye yahan koi Capacitor plugin nahi hoga.

export type SystemCategory = 
  | 'DEVICE_CONTROL'   
  | 'COMMUNICATION'    
  | 'UTILITY'          
  | 'MEDIA'            
  | 'NAVIGATION'       
  | 'KNOWLEDGE'        
  | 'IMAGE_GEN';       

export interface SystemResponse {
  success: boolean;
  category: SystemCategory;
  action: string;
  payload: any;
  message: string;
  shouldExecuteHardware?: boolean; // Naya flag taaki Phone ko pata chale action lena hai
}

export async function processUniversalCommand(intent: string, data: any = {}): Promise<SystemResponse> {
  const cleanIntent = intent.toLowerCase().trim();

  const categoryMap: Record<string, SystemCategory> = {
    flashlight: 'DEVICE_CONTROL',
    volume: 'DEVICE_CONTROL',
    brightness: 'DEVICE_CONTROL',
    whatsapp: 'COMMUNICATION',
    call: 'COMMUNICATION',
    alarm: 'UTILITY',
    reminder: 'UTILITY',
    camera: 'MEDIA',
    youtube: 'MEDIA',
    location: 'NAVIGATION',
    search: 'KNOWLEDGE',
    image: 'IMAGE_GEN'
  };

  const category = categoryMap[cleanIntent] || 'KNOWLEDGE';
  
  // Check agar hardware action chahiye (Jaise Flashlight ON/OFF)
  let executeHardware = false;
  if (['flashlight', 'vibration', 'call', 'camera'].includes(cleanIntent)) {
    executeHardware = true;
  }

  return {
    success: true,
    category: category,
    action: intent.toUpperCase(),
    payload: data,
    message: `Amina: Processing ${intent} command...`, 
    shouldExecuteHardware: executeHardware
  };
}