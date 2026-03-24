# SMS Integration in Booking Flow

## Overview
SMS notifications to landlords are automatically sent when a booking is confirmed.

## Integration Points

### 1. When Booking is Created with Payment (Immediate Confirmation)
**File:** `routes/bookings-enhanced.js` - POST route

**Trigger:** When `paymentId` is provided during booking creation
**Flow:**
- Booking is created with status: 'confirmed'
- SMS notification is sent immediately to landlord

**Code:**
```javascript
// If payment is confirmed with booking creation
if (paymentId && landlord && landlord.phoneNumber) {
  sendBookingConfirmationNotification(
    landlord._id,
    house.title,
    userName,
    userPhone,
    booking._id.toString()
  );
}
```

### 2. When Booking is Confirmed Manually
**File:** `routes/bookings-enhanced.js` - PATCH `/:id/confirm` route

**Trigger:** When student confirms a pending booking
**Flow:**
- Booking status changes from 'pending' to 'confirmed'
- SMS notification sent to landlord
- Response includes SMS notification status

**Code:**
```javascript
// After booking.status = 'confirmed'
if (landlord && landlord.phoneNumber) {
  sendBookingConfirmationNotification(
    landlord._id,
    house.title,
    booking.userName,
    booking.userPhone,
    booking._id.toString()
  );
}
```

## SMS Notification Details

### SMS Message Format
```
Hi [Landlord First Name],

Booking confirmed!

Student: [Student Name]
Contact: [Student Contact]
Property: [Property Name]
Booking ID: [Booking ID]

Landlord: [Landlord First Name] [Landlord Last Name]
Your Contact: [Landlord Phone]

Thank you for trusting us!

- ChukaCribs Team
```

### Example SMS
```
Hi Wycliffe,

Booking confirmed!

Student: John Doe
Contact: +254712345678
Property: Cozy 1-Bedroom Apartment near Campus
Booking ID: 60d6f2a5f8e9c123456789ab

Landlord: Wycliffe Ojode
Your Contact: +254715255115

Thank you for trusting us!

- ChukaCribs Team
```

## Functions Used

### sendBookingConfirmationNotification()
**File:** `routes/notifications.js`

**Parameters:**
- `landlordId` - MongoDB ID of landlord
- `houseTitle` - Name of the property
- `studentName` - Name of the student
- `studentPhone` - Phone number of student
- `bookingId` - Booking ID

**Returns:**
- Notification object with details

**Error Handling:**
- Non-blocking - errors don't affect booking creation
- Logs warnings if SMS fails
- Continues operation even if SMS doesn't send

### sendBookingConfirmationSMS()
**File:** `config/smsNotifications.js`

**Parameters:**
- `landlord` - Landlord document
- `data` - Object containing:
  - `studentName`
  - `studentContact`
  - `propertyName`
  - `bookingId`

**Returns:**
```javascript
{
  success: boolean,
  messageId: string,    // Africa's Talking message ID
  reason: string        // Error reason if failed
}
```

## API Endpoints

### Create Booking (with payment)
```
POST /api/bookings-enhanced
Content-Type: application/json

{
  "houseId": "60d6f2a5f8e9c123456789ab",
  "moveInDate": "2026-04-01T00:00:00Z",
  "userEmail": "student@example.com",
  "userName": "John Doe",
  "userPhone": "+254712345678",
  "tokenUsed": "access_token_string",
  "paymentId": "payment_id_from_mpesa"  // Optional - if provided, booking is confirmed immediately
}
```

**Response** (if SMS sent):
```javascript
{
  "success": true,
  "message": "Booking created successfully",
  "booking": {
    "id": "60d6f2a5f8e9c123456789ab",
    "status": "confirmed",
    "moveInDate": "2026-04-01T00:00:00Z"
  }
}
```

### Confirm Pending Booking
```
PATCH /api/bookings-enhanced/:bookingId/confirm
Authorization: Bearer <student-token>
```

**Response**:
```javascript
{
  "success": true,
  "message": "Booking confirmed successfully",
  "booking": {
    "id": "60d6f2a5f8e9c123456789ab",
    "status": "confirmed",
    "confirmedAt": "2026-03-07T10:30:00Z",
    "houseId": "60d6f2a5f8e9c123456789ab",
    "landlordNotified": true
  }
}
```

## Configuration

### Environment Variables Required
```bash
# SMS Provider Configuration
SMS_PROVIDER=africastalking
AFRICASTALKING_USERNAME=chuka_cribs
AFRICASTALKING_API_KEY=your_api_key_here
SMS_ENABLED=true
SMS_SENDER_ID=CHUKACRIBS
```

## Error Handling

SMS notifications are **non-blocking**:
- If SMS fails, booking still completes successfully
- Errors are logged for monitoring
- Response indicates whether SMS was sent

**Example error handling:**
```javascript
if (landlord && landlord.phoneNumber) {
  sendBookingConfirmationNotification(...)
    .catch(error => {
      logger.warn(`SMS failed: ${error.message}`);
      // Booking continues regardless
    });
}
```

## Logging

All SMS notifications are logged:

**Success:**
```
[INFO] Booking confirmed: 60d6f2a5f8e9c123456789ab
       bookingId: 60d6f2a5f8e9c123456789ab
       landlordId: 60d6f2a5f8e9c123456789ac
       SMSNotificationSent: true
```

**Failure:**
```
[WARN] Booking confirmation SMS notification failed: No phone number
```

## Testing

Test script: `test-sms-notifications.js`

```bash
node test-sms-notifications.js
```

Output shows:
- SMS message preview
- Character count
- Recipient phone number
- Validation checks

## Status

✅ SMS integration complete in booking flow
✅ Automatic sending on booking confirmation
✅ Landlord receives name + contact + thank you message
✅ Non-blocking implementation (won't break bookings)
✅ Production-ready with Africa's Talking integration
