import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'meal_planner.db');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    base_portions INTEGER NOT NULL,
    instructions TEXT,
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
`);

// Check if instructions column exists (in case table was previously created)
const tableInfo = db.prepare("PRAGMA table_info(recipes)").all() as any[];
const hasInstructions = tableInfo.some(col => col.name === 'instructions');
if (!hasInstructions) {
  db.exec("ALTER TABLE recipes ADD COLUMN instructions TEXT");
}
const hasImageUrl = tableInfo.some(col => col.name === 'image_url');
if (!hasImageUrl) {
  db.exec("ALTER TABLE recipes ADD COLUMN image_url TEXT");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes (id),
    FOREIGN KEY (ingredient_id) REFERENCES ingredients (id)
  );
`);

// Seed data if empty
const recipeCount = db.prepare('SELECT COUNT(*) as count FROM recipes').get() as { count: number };

if (recipeCount.count === 0) {
  console.log('Seeding initial recipes...');

  const insertRecipe = db.prepare('INSERT INTO recipes (name, base_portions, instructions, image_url) VALUES (?, ?, ?, ?)');
  const insertIngredient = db.prepare('INSERT OR IGNORE INTO ingredients (name) VALUES (?)');
  const getIngredientId = db.prepare('SELECT id FROM ingredients WHERE name = ?');
  const insertRecipeIngredient = db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES (?, ?, ?, ?)');

  const recipes = [
    {
      name: 'Classic Spaghetti Carbonara',
      base_portions: 2,
      instructions: '1. Boil pasta in salted water.\n2. Fry guanciale until crispy.\n3. Whisk eggs and cheese in a bowl.\n4. Combine all with pasta and some pasta water off heat.',
      image_url: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?q=80&w=800&auto=format&fit=crop',
      ingredients: [
        { name: 'Spaghetti', quantity: 200, unit: 'g' },
        { name: 'Guanciale (or Pancetta)', quantity: 100, unit: 'g' },
        { name: 'Eggs', quantity: 2, unit: 'unit' },
        { name: 'Pecorino Romano', quantity: 50, unit: 'g' },
        { name: 'Black Pepper', quantity: 5, unit: 'g' }
      ]
    },
    {
      name: 'Avocado Toast',
      base_portions: 1,
      instructions: '1. Toast bread.\n2. Mash avocado with lemon juice.\n3. Spread on toast.\n4. Top with red pepper flakes and a poached egg.',
      image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=800&auto=format&fit=crop',
      ingredients: [
        { name: 'Bread Slices', quantity: 2, unit: 'unit' },
        { name: 'Avocado', quantity: 1, unit: 'unit' },
        { name: 'Lemon Juice', quantity: 10, unit: 'ml' },
        { name: 'Red Pepper Flakes', quantity: 1, unit: 'g' },
        { name: 'Eggs', quantity: 1, unit: 'unit' }
      ]
    },
    {
      name: 'Pesto Pasta',
      base_portions: 4,
      instructions: '1. Cook pasta.\n2. Toss with pesto sauce and parmesan.\n3. Garnish with toasted pine nuts.',
      image_url: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?q=80&w=800&auto=format&fit=crop',
      ingredients: [
        { name: 'Fusilli', quantity: 500, unit: 'g' },
        { name: 'Pesto Sauce', quantity: 150, unit: 'g' },
        { name: 'Parmesan Cheese', quantity: 60, unit: 'g' },
        { name: 'Pine Nuts', quantity: 30, unit: 'g' }
      ]
    },
    {
      name: 'Chicken Caesar Salad',
      base_portions: 2,
      instructions: '1. Grill chicken and slice.\n2. Chop lettuce.\n3. Toss lettuce with dressing, croutons, and cheese.\n4. Top with chicken.',
      image_url: 'https://images.unsplash.com/photo-1550317138-10000687ad32?q=80&w=800&auto=format&fit=crop',
      ingredients: [
        { name: 'Romaine Lettuce', quantity: 1, unit: 'unit' },
        { name: 'Chicken Breast', quantity: 250, unit: 'g' },
        { name: 'Caesar Dressing', quantity: 60, unit: 'ml' },
        { name: 'Croutons', quantity: 50, unit: 'g' },
        { name: 'Parmesan Cheese', quantity: 20, unit: 'g' }
      ]
    }
  ];

  for (const r of recipes) {
    const info = insertRecipe.run(r.name, r.base_portions, r.instructions, r.image_url);
    const recipeId = info.lastInsertRowid;

    for (const ing of r.ingredients) {
      insertIngredient.run(ing.name);
      const row = getIngredientId.get(ing.name) as { id: number };
      insertRecipeIngredient.run(recipeId, row.id, ing.quantity, ing.unit);
    }
  }
}

export default db;
