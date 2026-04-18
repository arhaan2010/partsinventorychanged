import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAddcLqGKIxXD-NEJbHEoswZpcroBY7T9M",
  authDomain: "partsdb-e1965.firebaseapp.com",
  databaseURL: "https://partsdb-e1965-default-rtdb.firebaseio.com",
  projectId: "partsdb-e1965",
  storageBucket: "partsdb-e1965.firebasestorage.app",
  messagingSenderId: "56233607292",
  appId: "1:56233607292:web:d3d6ad050841abf67089f9"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };