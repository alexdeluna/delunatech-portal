
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyANW0_1Vc57r_T9oa6crF4sW-1Z9tiXEsU",
  authDomain: "delunatech-2f212.firebaseapp.com",
  projectId: "delunatech-2f212",
  storageBucket: "delunatech-2f212.firebasestorage.app",
  messagingSenderId: "458102188536",
  appId: "1:458102188536:web:1e00505a0f401157220e0d"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
