import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDvSgVznuvkuw69fCftj7ZYkTd6MzTw0Z4",
  authDomain: "jea-budget-tracker.firebaseapp.com",
  projectId: "jea-budget-tracker",
  storageBucket: "jea-budget-tracker.firebasestorage.app",
  messagingSenderId: "384416806544",
  appId: "1:384416806544:web:ab19354f4050d49ff74a15",
  measurementId: "G-3SLR5602NB"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);