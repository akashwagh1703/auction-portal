// Mock data — replace with API calls
export const MOCK_USERS = [
  { id: 1, name: 'Admin User', email: 'admin@auction.com', password: 'admin123', role: 'admin' },
  { id: 2, name: 'Team Mumbai', email: 'mumbai@auction.com', password: 'owner123', role: 'owner', teamId: 1 },
  { id: 3, name: 'Team Delhi', email: 'delhi@auction.com', password: 'owner123', role: 'owner', teamId: 2 },
  { id: 4, name: 'Virat Kohli', email: 'virat@auction.com', password: 'player123', role: 'player', playerId: 1 },
]

export const MOCK_TEAMS = [
  { id: 1, name: 'Mumbai Warriors', budget: 1000000, spent: 250000, color: '#1e40af', logo: '🏏' },
  { id: 2, name: 'Delhi Dynamos', budget: 1000000, spent: 180000, color: '#dc2626', logo: '⚡' },
  { id: 3, name: 'Chennai Kings', budget: 1000000, spent: 320000, color: '#d97706', logo: '👑' },
  { id: 4, name: 'Kolkata Knights', budget: 1000000, spent: 150000, color: '#7c3aed', logo: '🛡️' },
]

export const MOCK_PLAYERS = [
  { id: 1, name: 'Virat Kohli', role: 'Batsman', basePrice: 200000, soldPrice: null, teamId: null, status: 'unsold', rating: 95, country: 'India', age: 35, image: null },
  { id: 2, name: 'Rohit Sharma', role: 'Batsman', basePrice: 180000, soldPrice: 250000, teamId: 1, status: 'sold', rating: 92, country: 'India', age: 36, image: null },
  { id: 3, name: 'Jasprit Bumrah', role: 'Bowler', basePrice: 150000, soldPrice: null, teamId: null, status: 'unsold', rating: 94, country: 'India', age: 30, image: null },
  { id: 4, name: 'MS Dhoni', role: 'Wicket-Keeper', basePrice: 200000, soldPrice: 320000, teamId: 3, status: 'sold', rating: 90, country: 'India', age: 42, image: null },
  { id: 5, name: 'Hardik Pandya', role: 'All-Rounder', basePrice: 160000, soldPrice: null, teamId: null, status: 'pending', rating: 88, country: 'India', age: 30, image: null },
  { id: 6, name: 'KL Rahul', role: 'Batsman', basePrice: 140000, soldPrice: 180000, teamId: 2, status: 'sold', rating: 87, country: 'India', age: 32, image: null },
  { id: 7, name: 'Ravindra Jadeja', role: 'All-Rounder', basePrice: 130000, soldPrice: null, teamId: null, status: 'unsold', rating: 89, country: 'India', age: 35, image: null },
  { id: 8, name: 'Shubman Gill', role: 'Batsman', basePrice: 120000, soldPrice: null, teamId: null, status: 'unsold', rating: 85, country: 'India', age: 24, image: null },
]

export const MOCK_BIDS = [
  { id: 1, playerId: 5, teamId: 1, amount: 170000, timestamp: new Date(Date.now() - 30000) },
  { id: 2, playerId: 5, teamId: 2, amount: 185000, timestamp: new Date(Date.now() - 20000) },
  { id: 3, playerId: 5, teamId: 3, amount: 200000, timestamp: new Date(Date.now() - 10000) },
]

export const MOCK_CHAT = [
  { id: 1, teamId: 1, teamName: 'Mumbai Warriors', message: 'We are going all in for Pandya!', timestamp: new Date(Date.now() - 60000) },
  { id: 2, teamId: 2, teamName: 'Delhi Dynamos', message: 'Not if we can help it 😤', timestamp: new Date(Date.now() - 45000) },
  { id: 3, teamId: 3, teamName: 'Chennai Kings', message: 'May the best team win 🏆', timestamp: new Date(Date.now() - 30000) },
]
