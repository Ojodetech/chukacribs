# SMS Notification Format for ChukaCribs

## Overview
SMS notifications to landlords include:
- Landlord's first name
- Notification details (booking, payment, alert)
- Landlord name and contact information
- Thank you message

## SMS Notification Templates

### 1. Booking Notification SMS
**Sent when:** A student books a property
**Format:**
```
Hi [First Name],

You have a new booking request!

Student: [Student Name]
Contact: [Student Contact]
Property: [Property Name]

Landlord: [Landlord First Name] [Landlord Last Name]
Your Contact: [Landlord Phone]

Thank you for trusting us!

- ChukaCribs Team
```

**Example:**
```
Hi Wycliffe,

You have a new booking request!

Student: John Doe
Contact: +254712345678
Property: Cozy 1-Bedroom Apartment

Landlord: Wycliffe Ojode
Your Contact: +254715255115

Thank you for trusting us!

- ChukaCribs Team
```

### 2. Payment Confirmation SMS
**Sent when:** Payment is received for a booking
**Format:**
```
Hi [First Name],

Payment of KSH [Amount] received from [Student Name] for [Property].

Landlord: [Landlord First Name] [Landlord Last Name]
Contact: [Landlord Phone]

Thank you for trusting us!

- ChukaCribs Team
```

**Example:**
```
Hi Wycliffe,

Payment of KSH 5000 received from John Doe for Cozy 1-Bedroom Apartment.

Landlord: Wycliffe Ojode
Contact: +254715255115

Thank you for trusting us!

- ChukaCribs Team
```

### 3. Property Alert SMS
**Sent when:** Important alerts about properties
**Format:**
```
Hi [First Name],

Alert for [Property Name]:
[Alert Message]

Landlord: [Landlord First Name] [Landlord Last Name]
Contact: [Landlord Phone]

Thank you for trusting us!

- ChukaCribs Team
```

**Example:**
```
Hi Wycliffe,

Alert for Cozy 1-Bedroom Apartment:
Your property listing review period ends in 3 days.

Landlord: Wycliffe Ojode
Contact: +254715255115

Thank you for trusting us!

- ChukaCribs Team
```

## Integration Points

### In Booking Routes
```javascript
const { sendLandlordSMSNotification } = require('../config/smsNotifications');

// When booking is created
await sendLandlordSMSNotification(landlord, 'booking', {
  studentName: 'John Doe',
  studentContact: '+254712345678',
  propertyName: 'Cozy 1-Bedroom Apartment'
});
```

### In Payment Routes
```javascript
// When payment is confirmed
await sendLandlordSMSNotification(landlord, 'payment', {
  amount: 5000,
  studentName: 'John Doe',
  propertyName: 'Cozy 1-Bedroom Apartment'
});
```

### In Property Routes
```javascript
// For property alerts
await sendLandlordSMSNotification(landlord, 'alert', {
  alert: 'Your property listing review period ends in 3 days.',
  propertyName: 'Cozy 1-Bedroom Apartment'
});
```

## SMS Content Structure

Every landlord SMS notification includes:

1. **Greeting** - "Hi [First Name]"
2. **Notification Body** - Details of the event (booking, payment, etc)
3. **Landlord Info Block**
   - Landlord full name
   - Landlord phone number
4. **Closing Message** - "Thank you for trusting us!"
5. **Signature** - "ChukaCribs Team"

## Cost & Monitoring

- **Cost per SMS:** ~0.5-1 KSH (Africa's Talking)
- **Maximum Length:** SMS keeps within standard SMS length limits
- **Delivery Time:** Usually within 10-30 seconds
- **Tracking:** All SMS tracked in logs with message IDs

## Example Usage in Routes

```javascript
const Landlord = require('../models/Landlord');
const { sendLandlordSMSNotification } = require('../config/smsNotifications');

// Example: Send booking notification
router.post('/create-booking', async (req, res) => {
  try {
    // ... create booking logic ...
    
    const landlord = await Landlord.findById(booking.landlordId);
    
    // Send SMS notification
    const smsResult = await sendLandlordSMSNotification(landlord, 'booking', {
      studentName: booking.studentName,
      studentContact: booking.studentPhone,
      propertyName: booking.propertyName
    });
    
    if (smsResult.success) {
      logger.info('SMS notification sent', { messageId: smsResult.messageId });
    }
    
    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Features

✅ Includes landlord name and contact in every SMS
✅ Consistent thank you message
✅ Professional branding (ChukaCribs Team)
✅ Error handling and logging
✅ Multiple notification templates
✅ Easy integration with routes
✅ Production-ready

## Status

- ✅ SMS Configuration: Complete
- ✅ Africa's Talking Integration: Complete
- ✅ Notification Templates: Complete
- ✅ Error Handling: Complete
- ✅ Ready for Implementation: Yes