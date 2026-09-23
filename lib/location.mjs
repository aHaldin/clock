import {fail} from './security.mjs';
export function validateLocation(value,required,now=Date.now()) {
 if(value==null){if(required)fail(400,'Location is required. Allow location access and try again.');return null;}
 const {latitude,longitude,accuracy,capturedAt}=value;
 if(![latitude,longitude,accuracy,capturedAt].every(v=>typeof v==='number'&&Number.isFinite(v))||Math.abs(latitude)>90||Math.abs(longitude)>180||accuracy<0||!Number.isSafeInteger(capturedAt)||Math.abs(now-capturedAt)>120000)fail(400,'A fresh, valid location is required. Allow location access and try again.');
 return {latitude,longitude,accuracy,capturedAt};
}
// Only called after an engineer clicks Clock in/out. Never track in the background.
export function requestLocation(geolocation=globalThis.navigator?.geolocation,timeoutMs=12000){
 return new Promise((resolve,reject)=>{
  if(!geolocation){reject(new Error('Location is unavailable. Use an HTTPS browser with location access enabled.'));return;}
  let finished=false;
  const done=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);error?reject(error):resolve(value);};
  const timer=setTimeout(()=>done(new Error('Location timed out. Check location services and try again.')),timeoutMs);
  try{geolocation.getCurrentPosition(position=>done(null,{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,capturedAt:position.timestamp}),error=>done(new Error(error.code===1?'Location permission is required. Allow location for this site in your browser and device settings, then try again.':error.code===3?'Location timed out. Check location services and try again.':'Your location could not be found. Check location services and try again.')),{enableHighAccuracy:true,maximumAge:0,timeout:timeoutMs});}catch{done(new Error('Location is unavailable. Enable location services and try again.'));}
 });
}
