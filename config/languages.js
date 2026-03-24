// Multi-language support configuration
// Supports: English, Swahili, French

const translations = {
  en: {
    // Common
    welcome: 'Welcome',
    logout: 'Logout',
    back: 'Back',
    next: 'Next',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',

    // Auth
    login: 'Login',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    forgotPassword: 'Forgot Password?',
    rememberMe: 'Remember me',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    createAccount: 'Create Account',

    // Student
    studentLogin: 'Student Login',
    studentRegister: 'Student Registration',
    firstName: 'First Name',
    lastName: 'Last Name',
    phone: 'Phone Number',
    studentId: 'Student ID',
    university: 'University',
    course: 'Course',
    yearOfStudy: 'Year of Study',
    confirmPassword: 'Confirm Password',
    agreeToTerms: 'I agree to Terms & Conditions',

    // Landlord
    landlordLogin: 'Landlord Login',
    landlordRegister: 'Landlord Registration',
    landlordPortal: 'Landlord Portal',
    propertyName: 'Property Name',
    location: 'Location',
    price: 'Price',
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    description: 'Description',
    addProperty: 'Add Property',
    myProperties: 'My Properties',

    // Bookings
    bookings: 'Bookings',
    upcomingBookings: 'Upcoming Bookings',
    pastBookings: 'Past Bookings',
    checkIn: 'Check In',
    checkOut: 'Check Out',
    bookNow: 'Book Now',
    bookingConfirmed: 'Booking Confirmed',

    // Reviews
    reviews: 'Reviews',
    leaveReview: 'Leave a Review',
    rating: 'Rating',
    comment: 'Comment',
    submitReview: 'Submit Review',
    viewReviews: 'View Reviews',
    averageRating: 'Average Rating',

    // Messaging
    messages: 'Messages',
    sendMessage: 'Send Message',
    conversation: 'Conversation',
    replyMessage: 'Reply to Message',

    // Favorites
    favorites: 'Favorites',
    saveLater: 'Save for Later',
    addToFavorites: 'Add to Favorites',
    removeFromFavorites: 'Remove from Favorites',

    // Dashboard
    dashboard: 'Dashboard',
    analytics: 'Analytics',
    totalBookings: 'Total Bookings',
    totalRevenue: 'Total Revenue',
    trustScore: 'Trust Score',
    recentActivity: 'Recent Activity',

    // Search
    search: 'Search',
    searchProperties: 'Search Properties',
    filter: 'Filter',
    sortBy: 'Sort by',
    priceRange: 'Price Range',
    amenities: 'Amenities',
    results: 'Results',

    // Messages/Errors
    loginSuccess: 'Login successful',
    registerSuccess: 'Registration successful',
    errorOccurred: 'An error occurred',
    tryAgain: 'Try Again',
    noResults: 'No results found',
    validationError: 'Validation error',
  },

  sw: {
    // Common
    welcome: 'Karibu',
    logout: 'Toka',
    back: 'Rudi',
    next: 'Ijayo',
    save: 'Hifadhi',
    cancel: 'Ghairi',
    delete: 'Futa',
    edit: 'Hariri',
    loading: 'Inapakia...',
    error: 'Hitilafu',
    success: 'Imefanikiwa',

    // Auth
    login: 'Ingia',
    register: 'Jisajili',
    email: 'Barua pepe',
    password: 'Neno la siri',
    forgotPassword: 'Umesahau Neno la Siri?',
    rememberMe: 'Nikumbuke',
    signIn: 'Ingia',
    signUp: 'Jisajili',
    createAccount: 'Tengeneza Akaunti',

    // Student
    studentLogin: 'Ingia kama Mwanafunzi',
    studentRegister: 'Usajilishe kama Mwanafunzi',
    firstName: 'Jina la Kwanza',
    lastName: 'Jina la Ukoo',
    phone: 'Namba ya Simu',
    studentId: 'Kitambulisho cha Mwanafunzi',
    university: 'Chuo Kikuu',
    course: 'Kozi',
    yearOfStudy: 'Mwaka wa Masomo',
    confirmPassword: 'Thibitisha Neno la Siri',
    agreeToTerms: 'Nakubali Sheria na Masharti',

    // Landlord
    landlordLogin: 'Ingia kama Wajakazi',
    landlordRegister: 'Usajilishe kama Wajakazi',
    landlordPortal: 'Lango la Wajakazi',
    propertyName: 'Jina la Soko',
    location: 'Mahali',
    price: 'Bei',
    bedrooms: 'Vyumba vya Kulala',
    bathrooms: 'Vyumba vya Kuoga',
    description: 'Maelezo',
    addProperty: 'Ongeza Soko',
    myProperties: 'Soko Zangu',

    // Bookings
    bookings: 'Mabuku',
    upcomingBookings: 'Mabuku Yajayo',
    pastBookings: 'Mabuku ya Zamani',
    checkIn: 'Ingia',
    checkOut: 'Toka',
    bookNow: 'Buku Sasa',
    bookingConfirmed: 'Mabuku Yamethibitishwa',

    // Reviews
    reviews: 'Maoni',
    leaveReview: 'Acha Maoni',
    rating: 'Ukadiriaji',
    comment: 'Maoni',
    submitReview: 'Wasilisha Maoni',
    viewReviews: 'Angalia Maoni',
    averageRating: 'Wastani wa Ukadiriaji',

    // Messaging
    messages: 'Ujumbe',
    sendMessage: 'Tuma Ujumbe',
    conversation: 'Mazungumzo',
    replyMessage: 'Jibu Ujumbe',

    // Favorites
    favorites: 'Anuwai',
    saveLater: 'Hifadhi Kwa Baadaye',
    addToFavorites: 'Ongeza kwa Anuwai',
    removeFromFavorites: 'Ondoa kutoka Anuwai',

    // Dashboard
    dashboard: 'Dashibodi',
    analytics: 'Takwimu',
    totalBookings: 'Jumla ya Mabuku',
    totalRevenue: 'Jumla ya Mapato',
    trustScore: 'Alama ya Uaminifu',
    recentActivity: 'Shughuli za Karibuni',

    // Search
    search: 'Tafuta',
    searchProperties: 'Tafuta Soko',
    filter: 'Chuja',
    sortBy: 'Panga kwa',
    priceRange: 'Anuwai ya Bei',
    amenities: 'Huduma',
    results: 'Matokeo',

    // Messages/Errors
    loginSuccess: 'Ingia imefanikiwa',
    registerSuccess: 'Usajilishe umefanikiwa',
    errorOccurred: 'Hitilafu ilitokea',
    tryAgain: 'Jaribu Tena',
    noResults: 'Hakuna matokeo yaliyopatikana',
    validationError: 'Hitilafu ya uthibitisho',
  },

  fr: {
    // Common
    welcome: 'Bienvenue',
    logout: 'Déconnexion',
    back: 'Retour',
    next: 'Suivant',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',

    // Auth
    login: 'Connexion',
    register: 'Inscription',
    email: 'Email',
    password: 'Mot de passe',
    forgotPassword: 'Mot de passe oublié?',
    rememberMe: 'Se souvenir de moi',
    signIn: 'Se connecter',
    signUp: "S'inscrire",
    createAccount: 'Créer un compte',

    // Student
    studentLogin: 'Connexion Étudiant',
    studentRegister: 'Inscription Étudiant',
    firstName: 'Prénom',
    lastName: 'Nom de famille',
    phone: 'Numéro de téléphone',
    studentId: 'Numéro Étudiant',
    university: 'Université',
    course: 'Cours',
    yearOfStudy: 'Année Scolaire',
    confirmPassword: 'Confirmer Mot de passe',
    agreeToTerms: "J'accepte les Conditions d'utilisation",

    // Landlord
    landlordLogin: 'Connexion Propriétaire',
    landlordRegister: 'Inscription Propriétaire',
    landlordPortal: 'Portail Propriétaire',
    propertyName: 'Nom de la propriété',
    location: 'Localisation',
    price: 'Prix',
    bedrooms: 'Chambres',
    bathrooms: 'Salles de bain',
    description: 'Description',
    addProperty: 'Ajouter une propriété',
    myProperties: 'Mes propriétés',

    // Bookings
    bookings: 'Réservations',
    upcomingBookings: 'Réservations à venir',
    pastBookings: 'Réservations passées',
    checkIn: 'Arrivée',
    checkOut: 'Départ',
    bookNow: 'Réserver maintenant',
    bookingConfirmed: 'Réservation confirmée',

    // Reviews
    reviews: 'Avis',
    leaveReview: 'Laisser un avis',
    rating: 'Évaluation',
    comment: 'Commentaire',
    submitReview: 'Soumettre un avis',
    viewReviews: 'Voir les avis',
    averageRating: 'Évaluation moyenne',

    // Messaging
    messages: 'Messages',
    sendMessage: 'Envoyer un message',
    conversation: 'Conversation',
    replyMessage: 'Répondre au message',

    // Favorites
    favorites: 'Favoris',
    saveLater: 'Enregistrer pour plus tard',
    addToFavorites: 'Ajouter aux favoris',
    removeFromFavorites: 'Retirer des favoris',

    // Dashboard
    dashboard: 'Tableau de bord',
    analytics: 'Analytiques',
    totalBookings: 'Réservations totales',
    totalRevenue: 'Revenu total',
    trustScore: 'Score de confiance',
    recentActivity: 'Activité récente',

    // Search
    search: 'Recherche',
    searchProperties: 'Rechercher des propriétés',
    filter: 'Filtre',
    sortBy: 'Trier par',
    priceRange: 'Gamme de prix',
    amenities: 'Commodités',
    results: 'Résultats',

    // Messages/Errors
    loginSuccess: 'Connexion réussie',
    registerSuccess: 'Inscription réussie',
    errorOccurred: 'Une erreur est survenue',
    tryAgain: 'Réessayer',
    noResults: 'Aucun résultat trouvé',
    validationError: 'Erreur de validation',
  },
};

// Helper functions
const getLanguage = (lang = 'en') => {
  return translations[lang] || translations['en'];
};

const translate = (key, lang = 'en') => {
  const langObj = getLanguage(lang);
  return langObj[key] || key;
};

const setUserLanguage = (userId, language) => {
  // Store in Redis or database based on your preference
  // Example: userLanguagePreferences.set(userId, language);
  return language;
};

const getUserLanguage = (userId) => {
  // Retrieve from Redis or database
  // Example: return userLanguagePreferences.get(userId) || 'en';
  return 'en';
};

// Export functions
module.exports = {
  translations,
  getLanguage,
  translate,
  setUserLanguage,
  getUserLanguage,
};
