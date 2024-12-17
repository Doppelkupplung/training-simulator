import { openDB } from 'idb';

const DB_NAME = 'redditUserDB';
const STORE_NAME = 'redditUsers';
const VERSION = 1;

async function initDB() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      // Create a store of objects
      const store = db.createObjectStore(STORE_NAME, {
        // The 'id' property of the object will be the key
        keyPath: 'id',
        // If it isn't explicitly set, create automatically
        autoIncrement: true,
      });
      
      // Create indexes
      store.createIndex('username', 'username', { unique: true });
      store.createIndex('karma', 'karma', { unique: false });
      store.createIndex('created_at', 'created_at', { unique: false });
    },
  });
}

// Initialize the database connection
const dbPromise = initDB();

const dbService = {
  async getAllPersonas() {
    const db = await dbPromise;
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const users = await store.index('created_at').getAll();
    return users.reverse(); // newest first
  },

  async getPersonaById(id) {
    const db = await dbPromise;
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return store.get(id);
  },

  async createPersona(persona) {
    const db = await dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const timestamp = new Date().toISOString();
    const userToAdd = {
      ...persona,
      created_at: timestamp,
      updated_at: timestamp
    };
    
    const id = await store.add(userToAdd);
    await tx.done;
    
    return { ...userToAdd, id };
  },

  async updatePersona(persona) {
    const db = await dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const existing = await store.get(persona.id);
    if (!existing) return false;
    
    const updatedUser = {
      ...persona,
      created_at: existing.created_at,
      updated_at: new Date().toISOString()
    };
    
    await store.put(updatedUser);
    await tx.done;
    return true;
  },

  async deletePersona(id) {
    const db = await dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    await store.delete(id);
    await tx.done;
    return true;
  }
};

export default dbService; 