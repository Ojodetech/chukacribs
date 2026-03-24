/**
 * SMS Notification Templates for ChukaCribs
 * Sent to STUDENTS when bookings are confirmed
 * Landlords receive email notifications
 */

const sms = require('../config/sms');
const logger = require('../config/logger');

/**
 * Booking Confirmation SMS Template
 * Sent to STUDENT when a booking is confirmed
 * Includes landlord name and contact
 */
const BookingConfirmationSMS = {
  subject: 'Booking Confirmed',
  template: (studentName, landlordName, landlordContact, propertyName, bookingId) => {
    return `Hi ${studentName},\n\nBooking confirmed!\n\nProperty: ${propertyName}\nBooking ID: ${bookingId}\n\nLandlord: ${landlordName}\nLandlord Contact: ${landlordContact}\n\nThank you for trusting us!\n\n- ChukaCribs Team`;
  }
};


/**
 * Send SMS Notification to Student on Booking Confirmation
 * @param {string} studentPhone - Student phone number
 * @param {Object} data - Booking data {studentName, landlordName, landlordContact, propertyName, bookingId}
 * @returns {Promise<Object>} {success: boolean, messageId: string, reason: string}
 */
async function sendBookingConfirmationSMS(studentPhone, data) {
  try {
    if (!studentPhone) {
      logger.warn(`Student has no phone number for SMS notification`);
      return { success: false, reason: 'No phone number' };
    }

    // Generate SMS message for booking confirmation
    const smsMessage = BookingConfirmationSMS.template(
      data.studentName,
      data.landlordName,
      data.landlordContact,
      data.propertyName,
      data.bookingId
    );

    // Send SMS
    const result = await sms.sendSMS(studentPhone, smsMessage);

    if (result.success) {
      logger.info(`Booking confirmation SMS sent to student`, {
        studentPhone: studentPhone,
        bookingId: data.bookingId,
        messageId: result.messageId
      });
      return { success: true, messageId: result.messageId };
    } else {
      logger.warn(`Booking confirmation SMS failed for student`, {
        studentPhone: studentPhone,
        bookingId: data.bookingId,
        reason: result.response?.SMSMessageData?.Message
      });
      return { success: false, reason: result.response?.SMSMessageData?.Message };
    }
  } catch (error) {
    logger.error(`Send booking confirmation SMS error: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

module.exports = {
  sendBookingConfirmationSMS,
  BookingConfirmationSMS
};