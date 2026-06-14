require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');
const prisma = require('./prisma');

// Import routers
const authRouter = require('./routes/auth');
const groupsRouter = require('./routes/groups');
const expensesRouter = require('./routes/expenses');
const settlementsRouter = require('./routes/settlements');
const messagesRouter = require('./routes/messages');
const uploadRouter = require('./routes/upload');
const analyticsRouter = require('./routes/analytics');
const recurringRouter = require('./routes/recurring');
const scanRouter = require('./routes/scan');
const { startRecurringScheduler } = require('./utils/recurringScheduler');
const { logActivity } = require('./utils/activityLogger');

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: '*', // Allow all origins for dev/testing, can restrict in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/groups', groupsRouter);
app.use('/api', expensesRouter);
app.use('/api', settlementsRouter);
app.use('/api', messagesRouter);
app.use('/api', uploadRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api', recurringRouter);
app.use('/api', scanRouter);

// Serve Static Frontend Assets in Production
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback for Single Page Application (SPA) routing
app.get('*', (req, res, next) => {
  // If request is for API, pass through (e.g. it will return 404 API instead of index.html)
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      // If index.html is missing (e.g. in dev), return a friendly message
      res.status(200).send('API Server is running. Frontend build is missing (run build first).');
    }
  });
});

// Socket.io Config
const io = new Server(server, {
  cors: corsOptions
});

const JWT_SECRET = process.env.JWT_SECRET || 'splitwise-clone-development-secret-key-12345';

// Authenticate socket connections
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded; // Attach user info to socket
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected to socket: ${socket.user.name} (${socket.id})`);

  // Join a specific room corresponding to an expense chat
  socket.on('join_expense', async ({ expenseId }) => {
    try {
      // Verify user is member of the group that owns this expense
      const expense = await prisma.expense.findUnique({
        where: { id: expenseId },
        include: {
          group: {
            include: {
              members: true
            }
          }
        }
      });

      if (!expense) {
        return socket.emit('error', { message: 'Expense not found.' });
      }

      const isMember = expense.group.members.some(m => m.userId === socket.user.id);
      if (!isMember) {
        return socket.emit('error', { message: 'Access denied: Not a group member.' });
      }

      socket.join(expenseId);
      console.log(`User ${socket.user.name} joined room: ${expenseId}`);
    } catch (error) {
      console.error('Socket join room error:', error);
      socket.emit('error', { message: 'Error joining room.' });
    }
  });

  // Handle message sending
  socket.on('send_message', async ({ expenseId, content }) => {
    try {
      if (!content || content.trim() === '') return;

      // Create and persist message
      const message = await prisma.message.create({
        data: {
          expenseId,
          userId: socket.user.id,
          content: content.trim()
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      });

      // Broadcast message to everyone in the room
      io.to(expenseId).emit('receive_message', message);

      // Log comment activity
      const expenseObj = await prisma.expense.findUnique({
        where: { id: expenseId },
        select: { groupId: true, description: true }
      });
      if (expenseObj) {
        await logActivity(
          expenseObj.groupId,
          socket.user.id,
          'COMMENT',
          `${socket.user.name} commented on "${expenseObj.description}": "${content.trim().substring(0, 50)}${content.trim().length > 50 ? '...' : ''}"`
        );
      }
    } catch (error) {
      console.error('Socket message save error:', error);
      socket.emit('error', { message: 'Error sending message.' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.name} (${socket.id})`);
  });
});

// Start the HTTP Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`Splitwise Clone API listening on port ${PORT}`);
  console.log(`Serving frontend from: ${frontendDistPath}`);
  console.log(`===============================================`);
  // Start the automated recurring scheduler background process
  startRecurringScheduler();
});
