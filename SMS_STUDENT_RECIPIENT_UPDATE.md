# SMS Notification Refactor: Student Recipients Update

## Summary
Refactored the SMS notification system to send booking confirmation SMS to **STUDENTS** instead of landlords. Landlords continue to receive email notifications.

## Changes Made

### 1. **config/smsNotifications.js**
Updated the SMS notification template and function:

#### Before:
- Template addressed **landlord** by first name
- Included student phone as contact info
- SMS sent to landlord phone number

#### After:
- Template addresses **student** by name
- Includes **landlord name and phone** for student to contact
- SMS sent to student phone number

**Function Signature Change:**
```javascript
// Before
async function sendBookingConfirmationSMS(landlord, data)

// After  
async function sendBookingConfirmationSMS(studentPhone, data)
```

**New SMS Data Structure:**
```javascript
{
  studentName: string,          // Student's name
  landlordName: string,         // Landlord's full name
  landlordContact: string,      // Landlord's phone number
  propertyName: string,         // House/property title
  bookingId: string            // Booking ID
}
```

**New SMS Template Format:**
```
Hi [Student Name],

Booking confirmed!

Property: [Property Name]
Booking ID: [Booking ID]

Landlord: [Landlord Name]
Landlord Contact: [Landlord Phone]

Thank you for trusting us!

- ChukaCribs Team
```

### 2. **routes/notifications.js**
Updated `sendBookingConfirmationNotification()` function:

#### Function Signature Change:
```javascript
// Before
async function sendBookingConfirmationNotification(landlordId, houseTitle, studentName, studentPhone, bookingId)

// After
async function sendBookingConfirmationNotification(studentPhone, landlordId, houseTitle, studentName, bookingId)
```

**Key Changes:**
- Function now sends SMS to **student phone** instead of landlord phone
- Extracts landlord name and contact from database for SMS content
- Email notifications continue to go to landlord
- Logs SMS sent to student (not landlord)

### 3. **routes/bookings-enhanced.js**
Updated two calls to `sendBookingConfirmationNotification()`:

#### Call 1 (Booking Creation with Payment):
```javascript
// Before
if (paymentId && landlord && landlord.phoneNumber) {
  sendBookingConfirmationNotification(
    landlord._id,
    house.title,
    userName,
    userPhone,
    booking._id.toString()
  )
}

// After
if (paymentId && userPhone) {
  sendBookingConfirmationNotification(
    userPhone,          // Student phone first
    house.landlordId,
    house.title,
    userName,
    booking._id.toString()
  )
}
```

#### Call 2 (Booking Confirmation):
```javascript
// Before
if (landlord && landlord.phoneNumber) {
  sendBookingConfirmationNotification(
    landlord._id,
    house.title,
    booking.userName,
    booking.userPhone,
    booking._id.toString()
  )
}

// After
if (booking.userPhone) {
  sendBookingConfirmationNotification(
    booking.userPhone,  // Student phone first
    house.landlordId,
    house.title,
    booking.userName,
    booking._id.toString()
  )
}
```

## Notification Flow

### When a Booking is Confirmed (with Payment):
1. **SMS sent to STUDENT** with:
   - Student name greeting
   - Landlord name and contact
   - Property name
   - Booking ID
   - Thank you message

2. **Email sent to LANDLORD** with:
   - Booking confirmation notification
   - Student details

### When a Booking is Confirmed (without Payment):
1. **SMS sent to STUDENT** (same as above)
2. **Email sent to LANDLORD** (same as above)

## Testing

To verify the changes work correctly:

1. **Create a test booking** with payment:
   - Student should receive SMS with landlord contact info
   - Landlord should receive email notification

2. **Confirm a pending booking**:
   - Student should receive SMS confirmation with landlord details
   - Landlord should receive email confirmation

3. **Check SMS Format**:
   - Verify SMS includes student name greeting
   - Verify SMS includes landlord name and phone
   - Verify SMS includes property name and booking ID

## Validation Status
- ✅ config/smsNotifications.js - Syntax valid
- ✅ routes/notifications.js - Syntax valid  
- ✅ routes/bookings-enhanced.js - Syntax valid
- ✅ All parameter types correctly updated
- ✅ All function calls updated to new signature

## Notes
- Both SMS calls check for `userPhone` instead of `landlord.phoneNumber`
- Function now requires landlordId to fetch landlord details for SMS content
- Email notifications unchanged - still go to landlord
- Non-blocking error handling maintained
- Logging updated to reflect student recipients
