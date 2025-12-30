#!/usr/bin/env node

const API_BASE_URL = 'http://localhost:5001/api';
const ADMIN_PHONE = '9999999999';
const ADMIN_PASSWORD = 'admin123';

async function seedParticipants() {
  try {
    console.log('🔐 Logging in as admin...\n');
    
    // Login as admin
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: ADMIN_PHONE,
        password: ADMIN_PASSWORD,
      }),
    });

    const loginData = await loginResponse.json();

    if (!loginData.success) {
      console.error('❌ Login failed:', loginData.message);
      process.exit(1);
    }

    const token = loginData.token;
    console.log('✅ Logged in successfully!\n');

    // Check seed status first
    console.log('📊 Checking current status...\n');
    const statusResponse = await fetch(`${API_BASE_URL}/lottery/seed/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const statusData = await statusResponse.json();
    
    if (statusData.success) {
      console.log('Current Status:');
      console.log('=====================================');
      if (statusData.data.hasLottery) {
        console.log(`📋 Lottery: ${statusData.data.lottery.name}`);
        console.log(`🎯 Status: ${statusData.data.lottery.status}`);
        console.log(`🔢 Round: ${statusData.data.lottery.currentRound}`);
        console.log(`👥 Total Users: ${statusData.data.totalUsers}`);
        console.log(`✅ Active Participants: ${statusData.data.activeParticipants}`);
        console.log(`📝 Unregistered Users: ${statusData.data.unregisteredUsers}`);
      } else {
        console.log('⚠️  No lottery found');
      }
      console.log('=====================================\n');
    }

    // Seed participants
    console.log('🌱 Seeding participants from existing users...\n');
    const seedResponse = await fetch(`${API_BASE_URL}/lottery/seed/participants`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const seedData = await seedResponse.json();

    if (!seedData.success) {
      console.error('❌ Seeding failed:', seedData.message);
      process.exit(1);
    }

    console.log('✅ Seeding completed successfully!\n');
    console.log('Results:');
    console.log('=====================================');
    console.log(`🎰 Lottery: ${seedData.data.lotteryName}`);
    console.log(`🆔 Lottery ID: ${seedData.data.lotteryId}`);
    console.log(`👥 Total Users: ${seedData.data.totalUsers}`);
    console.log(`✅ New Participants: ${seedData.data.newParticipants}`);
    console.log(`⏭️  Already Registered: ${seedData.data.alreadyRegistered}`);
    console.log(`🎯 Total Participants: ${seedData.data.totalParticipants}`);
    console.log(`🔥 Active Participants: ${seedData.data.activeParticipants}`);
    console.log('=====================================\n');
    console.log('🎊 You can now execute spins!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedParticipants();
