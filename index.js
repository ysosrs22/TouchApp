const express = require('express');
const { ApolloServer, gql } = require('apollo-server');
const startStandaloneServer = require ('@apollo/server/standalone');
const mongoose = require ('mongoose') ;
const bcrypt= require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwtSecret = require('./config');
const authenticate = require('./authMiddleware');
const shortid = require('shortid');
const port = process.env.PORT || 4000;


mongoose.connect("mongodb+srv://Hamza:Hamza2000@lepointsurlei.92gvkme.mongodb.net/?retryWrites=true&w=majority", {
  useNewUrlParser: true
}).then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});

const userSchema = new mongoose.Schema({ 
  username: String,
  password: String,
  role: {
    type: String
  },
  fullName: String,
});
const warehouseSchema = new mongoose.Schema({
  warehouseID: {
    type: String,
    default: shortid.generate,
    unique: true,
  },
  warehouseName: String,
  coordinates: String,
  address: String,
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  type: String,
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    quantity: Number,
  }],
});

const storeSchema = new mongoose.Schema({
  storeID: {
    type: String,
    default: shortid.generate, // Generate a unique ID using shortid
    unique: true,
  },
  storeName : String,
  firstName: String,
  lastName: String,
  phonenumber1: String, 
  phonenumber2: String, 
  coordinates: String,
  address: String,
  storepic: {
    type: String,
  },
});
const productSchema = new mongoose.Schema({
  productID: {
    type: String,
    default: shortid.generate, // Generate a unique ID using shortid
    unique: true,
  },
  productName: {
    type: String,
  },
  quantity: Number,
  barcodenumber: String, 
  description: String, 
  productpic: {
    type: String,
  },
});

const saleSchema = new mongoose.Schema({
  saleID: {
    type: String,
    required: true,
    unique: true,
  },
  quantity: Number,
  totalamount: Number,
  paidamount: Number,
  remainingamount: Number,
  
  product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
  },
  salesperson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
},
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse'
},
  paymentstatus: {
     type: String,
     enum: ["paid", "partially paid", "unpaid"]
  },
});

// Create a model based on the schema
const User = mongoose.model('User', userSchema);
const Warehouse = mongoose.model('Warehouse', warehouseSchema);
const Store = mongoose.model('Store', storeSchema);
const Product = mongoose.model('Product', productSchema);
const Sale = mongoose.model('Sale', saleSchema);

module.exports = User;
module.exports = Warehouse;
module.exports = Store;
module.exports = Product;
module.exports = Sale;

const typeDefs = gql`
  type User {
    id: ID!
    username: String
    password: String
    fullName: String
    role: String
  }

  type AuthUser {
    user: User
    token: String
  }

  type Warehouse {
    id: ID!
    warehouseName: String
    coordinates: String
    address: String
    manager: User
    type: String
    products: [WarehouseProduct]
  }
  
  type WarehouseProduct {
    product: Product
    quantity: Int
  }

  type Store {
    id: ID!
    storeName : String
    firstName: String
    lastName: String
    phonenumber1: String 
    phonenumber2: String 
    coordinates: String
    address: String
    storepic: String
  }

  type Product {
    id: ID!
    productName: String
    barcodenumber: String 
    description: String 
    productpic: String
    quantity: Int
  }

  type Sale {
    id: ID!
    quantity: Float
    totalamount: Float
    paidamount: Float
    remainingamount: Float
    
    product: Product
    salesperson: User
    warehouse: Warehouse
    paymentstatus: String 
  }

  type Query {
    getUsers: [User]
    getProducts: [Product]
    getStores: [Store]
    getWarehouses: [Warehouse]
    getProductQuantity(warehouseID: ID!, productID: ID!): Int
    getManagedWarehouses(managerID: ID!): [Warehouse]

  }

  type Mutation {
    SignUp(username: String, password: String, fullName: String, role: String): AuthUser
    SignIn(username: String, password: String): AuthUser
    createProduct(productName:String, barcodenumber: String, description: String, productpic: String, quantity: Int): Product
    createStore(storeName : String,firstName: String, lastName: String, phonenumber1: String, phonenumber2: String, coordinates: String, address: String, storepic: String): Store
    createWarehouse(warehouseName: String, coordinates: String, address: String, manager: ID!, type: String): Warehouse
    updateUser(id: ID!, username: String, password: String, fullName: String, role: String): User
    deleteUser(id:ID!):User
    exportProductToFixedWarehouse(productID: ID!, warehouseID: ID!, quantity: Int!): Warehouse
    exportProductToMobileWarehouse(productID: ID!, sourceWarehouseID: ID!, destinationWarehouseID: ID!, quantity: Int!): [Warehouse]
    updateStore(id: ID!, storeName: String, firstName: String, lastName: String, phonenumber1: String, phonenumber2: String, coordinates: String, address: String, storepic: String): Store
    deleteStore(id: ID!): Store
    updateWarehouse( id: ID!, warehouseName: String, coordinates: String, address: String, manager: ID, type: String): Warehouse
    deleteWarehouse(id: ID!): Warehouse 
    
  } 
`;

const resolvers = {
  User: {
    id: (parent) => parent._id.toString(),
  },
  Warehouse: {
    id: (parent) => parent._id.toString(),
    manager: async (parent) => await User.findById(parent.manager).exec(),
    products: async (parent) => parent.products.map(async (p) => ({
      product: await Product.findById(p.product).exec(),
      quantity: p.quantity,
    })),
  },
  Query: {
    getUsers: async () => await User.find({}).exec(),
    getProducts: async () => await Product.find({}).exec(),
    getStores: async () => await Store.find({}).exec(),
    getWarehouses: async () => {
      try {
        const warehouses = await Warehouse.find({})
          .populate('manager') // Populate the manager field
          .exec();
        return warehouses;
      } catch (error) {
        console.error('Error retrieving warehouses:', error);
        throw new Error('Failed to retrieve warehouses');
      }
    },
    getProductQuantity: async (_, { warehouseID, productID }) => {
      try {
        const warehouse = await Warehouse.findById(warehouseID);
        if (!warehouse) {
          throw new Error(`Warehouse with ID ${warehouseID} not found`);
        }

        const product = warehouse.products.find(p => p.product.toString() === productID);
        if (!product) {
          throw new Error(`Product with ID ${productID} not found in the warehouse`);
        }
 
        return product.quantity;
      } catch (error) {
        console.error('Error retrieving product quantity:', error);
        throw new Error('Failed to retrieve product quantity');
      }
    },
    getManagedWarehouses: async (_, { managerID }) => {
      try {
        const warehouses = await Warehouse.find({ manager: managerID })
          .populate('manager') // Populate the manager field
          .exec();
        return warehouses;
      } catch (error) {
        console.error('Error retrieving managed warehouses:', error);
        throw new Error('Failed to retrieve managed warehouses');
      }
    },
  },
  Mutation: {
    SignUp: async (_, args) => {
      try {
        const { username, password } = args;
  
        // Check if the username already exists in the database
        const existingUser = await User.findOne({ username });
        if (existingUser) {
          throw new Error('Username already exists');
        }
  
        const hashedPassword = bcrypt.hashSync(password);
        const userArgs = {
          ...args,
          password: hashedPassword
        };
        let user = new User(userArgs);
        let response = await user.save();
        return response;
      } catch (e) {
        console.error('Error adding user:', e);
        throw new Error(`Failed to add user: ${e.message}`);
      }
    },

    SignIn: async (_, args) => {
      try {
        const { username, password } = args;
  
        // Find the user by username
        const user = await User.findOne({ username });
  
        if (!user) {
          throw new Error('User not found');
        }
  
        // Compare the provided password with the hashed password
        const isPasswordValid = bcrypt.compareSync(password, user.password);
  
        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }
  
        // Generate a token or perform any necessary authentication logic here
        const token = jwt.sign({ username }, jwtSecret, { expiresIn: '7d' });

  
        return {
          user,
          token
        };
      } catch (e) {
        console.error('Error signing in:', e);
        throw new Error(`Failed to sign in: ${e.message}`);
      }
    },

    createProduct: async (_, { productName, barcodenumber, description, productpic, quantity }) => {
      console.log('Creating new product:', { productName, barcodenumber, description, productpic, quantity });
      try {
        const existingProduct = await Product.findOne({ productName });
        if (existingProduct) {
          throw new Error('This product already exists');
        }
    
        const newProduct = new Product({
          productName,
          barcodenumber,
          description,
          productpic,
          quantity, // Store the initial quantity in the product schema
        });
    
        const result = await newProduct.save();
        console.log('New product created:', result);
    
        // Find the main warehouse
        const mainWarehouse = await Warehouse.findOne({ warehouseName: 'Main Warehouse' });
        if (!mainWarehouse) {
          throw new Error('Main warehouse not found');
        }
    
        // Update the main warehouse products array with the new product and initial quantity
        mainWarehouse.products.push({
          product: result._id,
          quantity,
        });
    
        await mainWarehouse.save();
    
        return result;
      } catch (error) {
        console.log('Error creating product:', error);
        throw new Error(error.message);
      }
    },
    
    

    createStore: async (_, args) => {
      console.log('Creating new store:', args);
      try {
        const store = new Store(args);
        const result = await store.save();
        console.log('New store created:', result);
        return result;
      } catch (error) {
        console.log('Error creating store:', error);
        throw new Error('Failed to create store');
      }
    },
    
    
     createWarehouse: async (_, args) => {
    console.log('Creating new warehouse:', args);
    try {
      // Check if the warehouse already exists in the database by its unique property (e.g., name)
      const existingWarehouse = await Warehouse.findOne({ warehouseName: args.warehouseName });
      if (existingWarehouse) {
        throw new Error('Warehouse with this name already exists');
      }

      const warehouse = new Warehouse(args);
      const result = await warehouse.save();
      console.log('New warehouse created:', result);
      return result;
    } catch (error) {
      console.log('Error creating warehouse:', error);
      throw new Error('Failed to create warehouse');
    }
  },
    updateUser: async (_, args) => {
      try {
        const { id, username, password, fullName, role } = args;
    
        // Find the user by ID
        const user = await User.findById(id);
        if (!user) {
          throw new Error('User not found');
        }
    
        // Update the user properties
        user.username = username;
        user.fullName = fullName;
        user.role = role;
    
        // Hash the password if provided
        if (password) {
          const hashedPassword = bcrypt.hashSync(password);
          user.password = hashedPassword;
        }
    
        // Save the updated user
        const updatedUser = await user.save();
        return updatedUser;
      } catch (error) {
        console.error('Error updating user:', error);
        throw new Error('Failed to update user');
      }
    },
    deleteUser: async (_, args) => {
      try {
        const { id } = args;
        const deletedUser = await User.findByIdAndDelete(id);
        return deletedUser;
      } catch (error) {
        console.error('Error deleting user:', error);
        throw new Error('Failed to delete user');

        }
      },

      exportProductToFixedWarehouse: async (_, args) => {
        try {
          const { productID, warehouseID, quantity } = args;
      
          const sourceWarehouse = await Warehouse.findOne({ warehouseName: 'Main Warehouse' });
          const destinationWarehouse = await Warehouse.findById(warehouseID);
      
          if (!sourceWarehouse || !destinationWarehouse) {
            throw new Error('Source or destination warehouse not found');
          }
      
          const sourceProductIndex = sourceWarehouse.products.findIndex(p => p.product.toString() === productID);
          if (sourceProductIndex === -1) {
            throw new Error('Product not found in the source warehouse');
          }
      
          const sourceProduct = sourceWarehouse.products[sourceProductIndex];
          if (sourceProduct.quantity < quantity) {
            throw new Error('Insufficient quantity in the source warehouse');
          }
      
          const destinationProductIndex = destinationWarehouse.products.findIndex(p => p.product.toString() === productID);
          if (destinationProductIndex === -1) {
            destinationWarehouse.products.push({
              product: productID,
              quantity,
            });
          } else {
            destinationWarehouse.products[destinationProductIndex].quantity += quantity;
          }
      
          sourceProduct.quantity -= quantity;
      
          const [sourceResult, destinationResult] = await Promise.all([
            sourceWarehouse.save(),
            destinationWarehouse.save(),
          ]);
      
          console.log('Product exported to fixed warehouse:', destinationResult);
      
          return destinationResult;
        } catch (error) {
          console.log('Error exporting product to fixed warehouse:', error);
          throw new Error('Failed to export product to fixed warehouse');
        }
      },
      
      
      
      exportProductToMobileWarehouse: async (_, args) => {
        try {
          const { productID, sourceWarehouseID, destinationWarehouseID, quantity } = args;
          
          const sourceWarehouse = await Warehouse.findById(sourceWarehouseID);
          const destinationWarehouse = await Warehouse.findById(destinationWarehouseID);
          
          if (!sourceWarehouse || !destinationWarehouse) {
            throw new Error('Source or destination warehouse not found');
          }
          
          const sourceProductIndex = sourceWarehouse.products.findIndex(p => p.product.toString() === productID);
          if (sourceProductIndex === -1) {
            throw new Error('Product not found in the source warehouse');
          }
          
          const sourceProduct = sourceWarehouse.products[sourceProductIndex];
          if (sourceProduct.quantity < quantity) {
            throw new Error('Insufficient quantity in the source warehouse');
          }
          
          const destinationProductIndex = destinationWarehouse.products.findIndex(p => p.product.toString() === productID);
          if (destinationProductIndex === -1) {
            destinationWarehouse.products.push({
              product: productID,
              quantity,
            });
          } else {
            destinationWarehouse.products[destinationProductIndex].quantity += quantity;
          }
          
          sourceProduct.quantity -= quantity;
          
          const result = await Promise.all([sourceWarehouse.save(), destinationWarehouse.save()]);
          console.log('Product exported to mobile warehouse:', result);
          return result;
        } catch (error) {
          console.log('Error exporting product to mobile warehouse:', error);
          throw new Error('Failed to export product to mobile warehouse');
        }
      },      

      updateStore: async (_, args) => {
        try {
          const { id, storeName, firstName, lastName, phonenumber1, phonenumber2, coordinates, address, storepic } = args;
  
          // Find the store by ID
          const store = await Store.findById(id);
          if (!store) {
            throw new Error('Store not found');
          }
  
          // Update the store properties
          store.storeName = storeName;
          store.firstName = firstName;
          store.lastName = lastName;
          store.phonenumber1 = phonenumber1;
          store.phonenumber2 = phonenumber2;
          store.coordinates = coordinates;
          store.address = address;
          store.storepic = storepic;
  
          // Save the updated store
          const updatedStore = await store.save();
          return updatedStore;
        } catch (error) {
          console.error('Error updating store:', error);
          throw new Error('Failed to update store');
        }
      },
  
      deleteStore: async (_, args) => {
        try {
          const { id } = args;
          const deletedStore = await Store.findByIdAndDelete(id);
          return deletedStore;
        } catch (error) {
          console.error('Error deleting store:', error);
          throw new Error('Failed to delete store');
        }
      },
      updateWarehouse: async (_, args) => {
        try {
          const { id, warehouseName, coordinates, address, manager, type } = args;
      
          // Find the warehouse by ID
          const warehouse = await Warehouse.findById(id);
          if (!warehouse) {
            throw new Error('Warehouse not found');
          }
      
          // Update the warehouse properties
          warehouse.warehouseName = warehouseName;
          warehouse.coordinates = coordinates;
          warehouse.address = address;
      
          // Only update the manager if a new manager has been provided
          if (manager !== null && manager !== undefined) {
            warehouse.manager = manager;
          }
      
          warehouse.type = type;
      
          // Save the updated warehouse
          const updatedWarehouse = await warehouse.save();
          return updatedWarehouse;
        } catch (error) {
          console.error('Error updating warehouse:', error);
          throw new Error('Failed to update warehouse');
        }
      },
      
     deleteWarehouse: async (_, args) => {
      try {
        const { id } = args;
        const deletedWarehouse = await Warehouse.findByIdAndDelete(id);
        return deletedWarehouse;
      } catch (error) {
        console.error('Error deleting warehouse:', error);
        throw new Error('Failed to delete warehouse');
      }
    },
  }
  
};


const server = new ApolloServer({ typeDefs, resolvers,  playground: false,
});
const app = express();
app.use(authenticate);

server.listen(port).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
