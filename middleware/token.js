const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Nema tokena, autorizacija odbijena.' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Dodajemo podatke iz tokena (npr. id, uloga) u request objekat
        next(); // Prosledi dalje
    } catch (error) {
        res.status(401).json({ message: 'Token nije validan.' });
    }
};

module.exports = authMiddleware;