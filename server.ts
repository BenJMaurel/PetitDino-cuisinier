import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import multer from 'multer';
import db from './db';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // Set up uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  // Serve uploads statically
  app.use('/uploads', express.static(uploadsDir));

  // Configure Multer for local storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only images are allowed'));
      }
    }
  });

  // API Endpoints
  app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  });

  app.get('/api/recipes', (req, res) => {
    try {
      const recipes = db.prepare(`
        SELECT 
          r.id, 
          r.name, 
          r.base_portions,
          r.instructions,
          r.image_url,
          json_group_array(
            json_object(
              'id', ri.id,
              'name', i.name,
              'quantity', ri.quantity,
              'unit', ri.unit
            )
          ) as ingredients
        FROM recipes r
        JOIN recipe_ingredients ri ON r.id = ri.recipe_id
        JOIN ingredients i ON ri.ingredient_id = i.id
        GROUP BY r.id
      `).all();

      // Transform strings to actual JSON (sqlite json_group_array returns string in some versions, 
      // but better-sqlite3 usually handles it well depending on how it's queried)
      const formattedRecipes = recipes.map((r: any) => ({
        ...r,
        ingredients: JSON.parse(r.ingredients)
      }));

      res.json(formattedRecipes);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      res.status(500).json({ error: 'Failed to fetch recipes' });
    }
  });

  app.post('/api/generate-list', (req, res) => {
    try {
      const { selectedRecipes } = req.body; // Array of { recipeId: number, desiredPortions: number }

      if (!selectedRecipes || !Array.isArray(selectedRecipes)) {
        return res.status(400).json({ error: 'Invalid selectedRecipes' });
      }

      const aggregatedIngredients: Record<string, { quantity: number; unit: string; name: string }> = {};

      for (const selection of selectedRecipes) {
        const recipe = db.prepare('SELECT base_portions FROM recipes WHERE id = ?').get(selection.recipeId) as { base_portions: number };
        if (!recipe) continue;

        const scalingFactor = selection.desiredPortions / recipe.base_portions;

        const ingredients = db.prepare(`
          SELECT i.name, ri.quantity, ri.unit
          FROM recipe_ingredients ri
          JOIN ingredients i ON ri.ingredient_id = i.id
          WHERE ri.recipe_id = ?
        `).all(selection.recipeId) as { name: string; quantity: number; unit: string }[];

        for (const ing of ingredients) {
          const key = `${ing.name.toLowerCase()}-${ing.unit.toLowerCase()}`;
          const scaledQuantity = ing.quantity * scalingFactor;

          if (aggregatedIngredients[key]) {
            aggregatedIngredients[key].quantity += scaledQuantity;
          } else {
            aggregatedIngredients[key] = {
              name: ing.name,
              quantity: scaledQuantity,
              unit: ing.unit
            };
          }
        }
      }

      // Convert map to array and round quantities to 2 decimal places
      const result = Object.values(aggregatedIngredients).map(item => ({
        ...item,
        quantity: Math.round(item.quantity * 100) / 100
      }));

      res.json(result);
    } catch (error) {
      console.error('Error generating grocery list:', error);
      res.status(500).json({ error: 'Failed to generate grocery list' });
    }
  });

  app.post('/api/recipes', (req, res) => {
    const { name, base_portions, instructions, image_url, ingredients } = req.body;

    if (!name || typeof base_portions !== 'number' || !ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Missing required fields or invalid ingredients' });
    }

    try {
      const createTransaction = db.transaction(() => {
        // Create recipe main info
        const result = db.prepare('INSERT INTO recipes (name, base_portions, instructions, image_url) VALUES (?, ?, ?, ?)').run(name, base_portions, instructions || '', image_url || '');
        const recipeId = result.lastInsertRowid;

        // Insert ingredients
        const insertIngredient = db.prepare('INSERT OR IGNORE INTO ingredients (name) VALUES (?)');
        const getIngredientId = db.prepare('SELECT id FROM ingredients WHERE name = ?');
        const insertRecipeIngredient = db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES (?, ?, ?, ?)');

        for (const ing of ingredients) {
          if (!ing.name || typeof ing.quantity !== 'number' || !ing.unit) {
            throw new Error(`Invalid ingredient data: ${JSON.stringify(ing)}`);
          }
          insertIngredient.run(ing.name);
          const row = getIngredientId.get(ing.name) as { id: number };
          insertRecipeIngredient.run(recipeId, row.id, ing.quantity, ing.unit);
        }
      });

      createTransaction();
      res.status(201).json({ success: true });
    } catch (error: any) {
      console.error('Error creating recipe:', error);
      res.status(500).json({ error: error.message || 'Failed to create recipe' });
    }
  });

  app.put('/api/recipes/:id', (req, res) => {
    const { id } = req.params;
    const { name, base_portions, instructions, image_url, ingredients } = req.body;

    if (!name || typeof base_portions !== 'number' || !ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Missing required fields or invalid ingredients' });
    }

    try {
      const updateTransaction = db.transaction(() => {
        // Update recipe main info
        const result = db.prepare('UPDATE recipes SET name = ?, base_portions = ?, instructions = ?, image_url = ? WHERE id = ?').run(name, base_portions, instructions || '', image_url || '', id);
        
        if (result.changes === 0) {
          throw new Error('Recipe not found');
        }

        // Delete existing ingredients for this recipe
        db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id);

        // Insert new/existing ingredients
        const insertIngredient = db.prepare('INSERT OR IGNORE INTO ingredients (name) VALUES (?)');
        const getIngredientId = db.prepare('SELECT id FROM ingredients WHERE name = ?');
        const insertRecipeIngredient = db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) VALUES (?, ?, ?, ?)');

        for (const ing of ingredients) {
          if (!ing.name || typeof ing.quantity !== 'number' || !ing.unit) {
            throw new Error(`Invalid ingredient data: ${JSON.stringify(ing)}`);
          }
          insertIngredient.run(ing.name);
          const row = getIngredientId.get(ing.name) as { id: number };
          insertRecipeIngredient.run(id, row.id, ing.quantity, ing.unit);
        }
      });

      updateTransaction();
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating recipe:', error);
      if (error.message === 'Recipe not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || 'Failed to update recipe' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
