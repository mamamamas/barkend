const jwt = require('jsonwebtoken');

const validateToken = async (req, res, next) => {
    const authHeader = req.headers.Authorization || req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(" ")[1];

        try {
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

            // Ensure the audience matches what you expect
            if (decoded.aud !== 'Saulus') {
                throw new Error('Invalid audience');
            }

            req.user = decoded; // Attach the entire decoded token
            next();
        } catch (err) {
            console.error('JWT verification failed:', err);
            return res.status(401).json({ message: "User not authenticated" });
        }
    } else {
        return res.status(401).json({ message: "User not authenticated or token is invalid" });
    }
};

module.exports = validateToken;