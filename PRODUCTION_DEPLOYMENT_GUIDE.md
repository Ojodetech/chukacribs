# 🚀 ChukaCribs Production Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. Africa's Talking Production Setup
- [ ] **Register for Production Account**: Go to [Africa's Talking](https://account.africastalking.com/)
- [ ] **Verify Account**: Complete business verification process
- [ ] **Get Production API Key**: Different from sandbox key
- [ ] **Register Sender ID**: Get approved sender name (CHUKACRIBS)
- [ ] **Top-up Account**: Add credit for SMS sending

### 2. M-Pesa Production Setup
- [ ] **Apply for Production Access**: [Safaricom Daraja Portal](https://developer.safaricom.co.ke/)
- [ ] **Business Verification**: Complete KYC process
- [ ] **Get Production Credentials**: Consumer Key, Secret, Shortcode, Passkey
- [ ] **Configure Callback URLs**: Point to production domain

### 3. Environment Configuration
- [ ] **Update .env.production** with real values
- [ ] **Set Production Database**: MongoDB Atlas production cluster
- [ ] **Configure Domain URLs**: Update FRONTEND_URL, BACKEND_URL
- [ ] **Generate New Secrets**: JWT_SECRET, ADMIN_SECRET_KEY

### 4. Infrastructure Setup
- [ ] **Domain Registration**: chukacribs.co.ke
- [ ] **SSL Certificate**: HTTPS setup
- [ ] **Render Account**: Production hosting
- [ ] **MongoDB Atlas**: Production database

## 🔧 Production Environment Variables

Update these in Render dashboard:

```bash
# Africa's Talking (Production)
AFRICASTALKING_USERNAME=chuka_cribs
AFRICASTALKING_API_KEY=your_production_api_key_here
SMS_SENDER_ID=CHUKACRIBS  # Or approved sender ID

# M-Pesa (Production)
MPESA_ENVIRONMENT=production
MPESA_CONSUMER_KEY=prod_consumer_key
MPESA_CONSUMER_SECRET=prod_consumer_secret
MPESA_BUSINESS_SHORTCODE=prod_shortcode
MPESA_PASSKEY=prod_passkey

# Database & Security
MONGODB_URI=production_mongodb_uri
JWT_SECRET=strong_production_secret
ADMIN_SECRET_KEY=strong_admin_secret
```

## 📱 Testing Production SMS

After deployment, test with real phone numbers:

```bash
# Test SMS in production
curl -X POST https://chukacribs.co.ke/api/test-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "+254712345678", "message": "Production test"}'
```

## 🚀 Deployment Steps

1. **Push to Git**: Commit all production-ready code
2. **Render Dashboard**: Update environment variables
3. **Deploy**: Trigger deployment from Render
4. **Test Endpoints**: Verify all APIs work
5. **Domain Setup**: Point domain to Render service
6. **SSL Setup**: Enable HTTPS
7. **Final Testing**: Test complete user flow

## 📊 Production Monitoring

- [ ] **SMS Delivery**: Monitor Africa's Talking dashboard
- [ ] **Payment Processing**: Check M-Pesa transaction logs
- [ ] **Error Logs**: Monitor Render logs
- [ ] **Database**: Monitor MongoDB Atlas metrics
- [ ] **Uptime**: Set up monitoring alerts

## 💰 Production Costs

- **SMS**: ~0.5-1 KSH per message (Africa's Talking)
- **M-Pesa**: Transaction fees apply
- **Hosting**: Render free tier or paid plans
- **Database**: MongoDB Atlas pricing

## 🔒 Security Checklist

- [ ] **Environment Variables**: Never commit secrets
- [ ] **API Keys**: Rotate regularly
- [ ] **Database Access**: Restrict IP access
- [ ] **HTTPS Only**: Force SSL
- [ ] **Rate Limiting**: Implement request limits
- [ ] **Input Validation**: Sanitize all inputs

## 🎯 Go-Live Checklist

- [ ] All environment variables set
- [ ] Africa's Talking production account active
- [ ] M-Pesa production credentials configured
- [ ] Domain and SSL configured
- [ ] Database migrated to production
- [ ] All endpoints tested
- [ ] SMS sending verified
- [ ] Payment processing tested
- [ ] Admin panel accessible
- [ ] User registration flow working

---

**Status**: ✅ SMS Integration Complete | 🟡 Ready for Production Setup</content>
<parameter name="filePath">c:\Users\User\Desktop\Chuka_cribs\PRODUCTION_DEPLOYMENT_GUIDE.md