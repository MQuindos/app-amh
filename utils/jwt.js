const jwt = require('jsonwebtoken');

// const jwtConfig = {
//   'secret': process.env.JWT_SECRET,
//   'expiresIn': process.env.JWT_EXPIRATION
// };

module.exports = class {
    constructor() {
        this.secretOrPrivateKey = process.env.JWT_SECRET;
        this.secretOrPublicKey = process.env.JWT_SECRET;
        this.options = { expiresIn: process.env.JWT_EXPIRATION };
    }

    config() {
        return jwtConfig;
    }

    createToken(payload) {
        return new Promise((resolve, reject) =>
            jwt.sign({ data: payload },
                this.secretOrPrivateKey,
                this.options,
                (err, obj) => (err ? reject(err) : resolve(obj))
            )
        );
    }

    verifyToken(token) {
        return jwt.verify(token, this.secretOrPublicKey);
    }
};