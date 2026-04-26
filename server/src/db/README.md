# Database

The application uses MongoDB through Mongoose.

## Configuration

Set a full connection string when possible:

```env
MONGODB_URI=mongodb://localhost:27017/patient_portal
```

For production, use a secret-managed MongoDB Atlas or equivalent connection string:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/?appName=APP
```

`DB_NAME` is optional and defaults to `patient_portal` when individual database settings are used.

## Code

- `config.ts` builds and opens the MongoDB connection.
- `types.ts` defines shared DTOs and request/response shapes.
- `repositories/` contains model-backed data access helpers.

## Testing

Most tests use MongoDB Memory Server or test-specific setup helpers, so a local MongoDB instance is not required for the standard test suite.
