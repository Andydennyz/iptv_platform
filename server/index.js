const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const channelRoutes = require('./routes/channels');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', channelRoutes);

app.get('/', (req, res) => {
  res.send('IPTV Node API running');
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
