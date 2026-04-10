// Mock Firebase config — replace with your actual Firebase project config
// From: https://console.firebase.google.com/ → Project Settings → Your Apps

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBNdMAoimgkkNcwrZwgWUR_MDKBH28s7vE",
  authDomain: "sunhacks-v2.firebaseapp.com",
  projectId: "sunhacks-v2",
  storageBucket: "sunhacks-v2.firebasestorage.app",
  messagingSenderId: "119368822923",
  appId: "1:119368822923:web:a53faa3f0913ed1289a48e",
  measurementId: "G-GCC1BR9XVQ",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
