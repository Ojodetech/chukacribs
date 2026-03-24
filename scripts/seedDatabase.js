const mongoose = require('mongoose');
const House = require('../models/House');

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/chukacribs', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected for seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const sampleHouses = [
  {
    title: "Cozy 2-Bedroom House",
    location: "Chuka Town Center",
    price: 8500,
    type: "apartment",
    description: "A beautiful and spacious 2-bedroom apartment in the heart of Chuka with modern amenities, furnished rooms, and 24/7 security.",
    images: [
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%236366f1' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E2-Bedroom Apartment%3C/text%3E%3C/svg%3E",
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23ec4899' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E Living Room%3C/text%3E%3C/svg%3E",
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%2310b981' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E Kitchen%3C/text%3E%3C/svg%3E"
    ],
    videos: [
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/9bZkp7q19f0"
    ],
    features: [
      "2 Bedrooms",
      "1 Bathroom",
      "WiFi Included",
      "Furnished",
      "Water & Electricity",
      "Parking Space"
    ],
    landlord: "John Kipchoge",
    contact: "+254 700 000001",
    available: true,
    rating: 4.5,
    submittedBy: "admin",
    approved: true
  },
  {
    title: "Single Room Bedsitter",
    location: "Near Chuka University",
    price: 4500,
    type: "bedsitter",
    description: "Neat and well-maintained single room with attached bathroom, ideal for students. Close to campus and with reliable water supply.",
    images: [
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%2306b6d4' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E Bedsitter%3C/text%3E%3C/svg%3E",
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%238b5cf6' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E Bedroom%3C/text%3E%3C/svg%3E"
    ],
    videos: [
      "https://www.youtube.com/embed/jNQXAC9IVRw"
    ],
    features: [
      "1 Bedroom",
      "Attached Bath",
      "WiFi",
      "Near Campus",
      "Water Supply"
    ],
    landlord: "Mary Wanjiru",
    contact: "+254 700 000002",
    available: true,
    rating: 4.2,
    submittedBy: "admin",
    approved: true
  },
  {
    title: "Luxury 3-Bedroom House",
    location: "Chuka Nyumba Estate",
    price: 18000,
    type: "apartment",
    description: "Premium 3-bedroom house with modern fixtures, large living area, equipped kitchen, and beautiful compound for parking.",
    images: [
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f59e0b' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E 3-Bedroom House%3C/text%3E%3C/svg%3E",
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%236366f1' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E Master Bedroom%3C/text%3E%3C/svg%3E",
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23ec4899' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E Compound%3C/text%3E%3C/svg%3E"
    ],
    videos: [
      "https://www.youtube.com/embed/a3ICNMQW7Ok"
    ],
    features: [
      "3 Bedrooms",
      "2 Bathrooms",
      "WiFi",
      "Furnished",
      "Parking",
      "Solar Power",
      "24/7 Security"
    ],
    landlord: "David Mwangi",
    contact: "+254 700 000003",
    available: true,
    rating: 4.8,
    submittedBy: "admin",
    approved: true
  },
  {
    title: "Shared Double Room",
    location: "Near Chuka Market",
    price: 5500,
    type: "double",
    description: "Spacious double room perfect for two students, shared kitchen and sitting area. Great location with easy access to market and transport.",
    images: [
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%2310b981' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E Double Room%3C/text%3E%3C/svg%3E",
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f59e0b' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E Shared Kitchen%3C/text%3E%3C/svg%3E"
    ],
    videos: [],
    features: [
      "Double Room",
      "Shared Kitchen",
      "WiFi Available",
      "24-Hour Water",
      "Secure Area"
    ],
    landlord: "Grace Mutua",
    contact: "+254 700 000004",
    available: true,
    rating: 4.0,
    submittedBy: "admin",
    approved: true
  },
  {
    title: "Modern Apartment",
    location: "Chuka Business District",
    price: 12000,
    type: "apartment",
    description: "Contemporary apartment with open floor plan, modern bathroom fixtures, and excellent natural lighting. Perfect for students and young professionals.",
    images: [
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%238b5cf6' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E Modern Apartment%3C/text%3E%3C/svg%3E",
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23ec4899' width='400' height='300'/%3E%3Ctext x='50%' y='50%' font-size='20' fill='white' text-anchor='middle' dy='.3em'%3E Bathroom%3C/text%3E%3C/svg%3E"
    ],
    videos: [
      "https://www.youtube.com/embed/O91DT1pR1dw"
    ],
    features: [
      "2 Bedrooms",
      "Modern Bathroom",
      "WiFi",
      "Parking",
      "Reliable Electricity"
    ],
    landlord: "Samuel Koech",
    contact: "+254 700 000005",
    available: true,
    rating: 4.3,
    submittedBy: "admin",
    approved: true
  }
];

const seedDatabase = async () => {
  try {
    // Clear existing houses
    await House.deleteMany({});
    console.log('🗑️  Cleared existing houses');

    // Insert sample houses
    const insertedHouses = await House.insertMany(sampleHouses);
    console.log(`✅ Successfully seeded ${insertedHouses.length} houses`);

    // Display summary
    console.log('\n📊 Database Summary:');
    console.log(`Total Houses: ${insertedHouses.length}`);
    const avgPrice = sampleHouses.reduce((a, b) => a + b.price, 0) / sampleHouses.length;
    console.log(`Average Price: KSH ${avgPrice.toFixed(0)}`);
    console.log(`Price Range: KSH ${Math.min(...sampleHouses.map(h => h.price))} - KSH ${Math.max(...sampleHouses.map(h => h.price))}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  }
};

connectDB().then(seedDatabase);