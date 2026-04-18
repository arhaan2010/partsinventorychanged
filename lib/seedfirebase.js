import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

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

const data = {
  members: {
    member_1: { name: "Aryan Mehta", role: "Drive Train Lead" },
    member_2: { name: "Priya Sharma", role: "Sensors & Vision" },
    member_3: { name: "Rohan Das", role: "Mechanical Design" },
    member_4: { name: "Nisha Kapoor", role: "Software Lead" },
    member_5: { name: "Dev Patel", role: "Electrical" }
  },

  parts: {
    part_1: { name: "Arduino Mega 2560", category: "Microcontroller", qty: 3, available: 2, ownerId: "member_1" },
    part_2: { name: "Servo Motor MG996R", category: "Actuator", qty: 6, available: 4, ownerId: "member_2" },
    part_3: { name: "LiDAR Sensor RPLidar A1", category: "Sensor", qty: 2, available: 1, ownerId: "member_2" },
    part_4: { name: "DC Motor 12V 200RPM", category: "Actuator", qty: 8, available: 5, ownerId: "member_3" },
    part_5: { name: "L298N Motor Driver", category: "Driver", qty: 4, available: 3, ownerId: "member_5" }
  },

  requests: {
    request_1: {
      partId: "part_3",
      requesterId: "member_4",
      ownerId: "member_2",
      qty: 1,
      purpose: "Testing autonomous navigation module",
      status: "pending",
      date: "2026-04-15",
      timestamp: 1744675200000
    }
  }
};

async function seed() {
  try {
    await set(ref(db), data);
    console.log("Database seeded successfully.");
  } catch (err) {
    console.error("Seeding failed:", err);
  }
  process.exit(0);
}

seed();