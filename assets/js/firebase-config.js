// assets/js/firebase-config.js
// Firebase SDK 모듈 CDN import
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Your web app's Firebase configuration
// (사용자가 제공한 설정 값)
const firebaseConfig = {
  apiKey: "AIzaSyBO9tShfmq6MM6V0igKmIuUkg-U_9sW13g",
  authDomain: "matjip-jido-a6020.firebaseapp.com",
  projectId: "matjip-jido-a6020",
  storageBucket: "matjip-jido-a6020.firebasestorage.app",
  messagingSenderId: "794785619474",
  appId: "1:794785619474:web:06b7e2d25088742fea42cb",
  measurementId: "G-YZBYZX7G7B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // GitHub Pages 환경 등에서 analytics가 동작하지 않아도 앱 자체는 돌아가게
  console.warn("Analytics init skipped:", e?.message);
}

const auth = getAuth(app);
const db = getFirestore(app);

// 다른 모듈에서 사용할 수 있도록 export
export {
  app,
  analytics,
  auth,
  db,
  // auth helpers
  signInAnonymously,
  onAuthStateChanged,
  // firestore helpers
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
};
