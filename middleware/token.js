// token.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // EXEMPT PATHS: dodaj sve rute koje Paddle koristi (webhooks, paylink endpoint itd.)
    const openPaths = [
      '/api/webhooks',        // tvoj webhook endpoint
      '/api/paddle/paylink',  // primer endpointa koji generiše paylink/JWT
      // dodaj druge rute ako koristiš
    ];

    // Ako putanja započinje nekom od exempt pathova, preskoči autorizaciju
    if (openPaths.some(p => req.path.startsWith(p))) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Nema tokena, autorizacija odbijena.' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token nije validan.' });
    }
};

module.exports = authMiddleware;
