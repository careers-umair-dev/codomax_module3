const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/token');

const SALT_ROUNDS = 10;

// Compared against when the email is unknown so response time doesn't reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', SALT_ROUNDS);

/** The only shape of a user that ever leaves the service layer. */
function toSafeUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

async function register({ name, email, password }) {
  if (await userRepository.findByEmail(email)) {
    throw ApiError.conflict('An account with this email already exists.', {
      errors: [{ field: 'email', message: 'An account with this email already exists.' }],
    });
  }

  const user = await userRepository.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
  });

  return toSafeUser(user);
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  const matches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !matches) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  return { token: signToken(user), user: toSafeUser(user) };
}

async function getCurrentUser(id) {
  const user = await userRepository.findById(id);
  return user ? toSafeUser(user) : null;
}

module.exports = { register, login, getCurrentUser };
