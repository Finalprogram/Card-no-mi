const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const DailyMission = sequelize.define('DailyMission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  icon: {
    type: DataTypes.STRING,
    defaultValue: 'fa-trophy'
  },
  type: {
    type: DataTypes.ENUM('create_thread', 'create_post', 'give_reaction', 'receive_reaction', 'upvote', 'login'),
    allowNull: false
  },
  requirement: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  rewardPoints: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'daily_missions',
  timestamps: true,
  updatedAt: false
});

const UserDailyProgress = sequelize.define('UserDailyProgress', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  missions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  totalPointsEarned: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'user_daily_progresses',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['userId', 'date'], unique: true }
  ]
});

module.exports = { DailyMission, UserDailyProgress };

UserDailyProgress.getTodayProgress = async (userId) => {
  if (!userId) return { missions: [], totalPointsEarned: 0, lastUpdate: new Date() };

  const today = new Date().toISOString().slice(0, 10);
  const [progress] = await UserDailyProgress.findOrCreate({
    where: { userId, date: today },
    defaults: { missions: [], totalPointsEarned: 0 }
  });

  const dailyMissions = await DailyMission.findAll({ where: { isActive: true } });
  const storedMissions = Array.isArray(progress.missions) ? progress.missions : [];
  const storedMap = new Map(storedMissions.map(m => [m.key || m.type, m]));

  let updated = false;
  const merged = dailyMissions.map(mission => {
    const key = mission.key || mission.type;
    const existing = storedMap.get(key);
    const currentProgress = existing?.currentProgress ?? 0;
    const isCompleted = existing?.isCompleted ?? false;
    const completedAt = existing?.completedAt ?? null;

    if (!existing) updated = true;

    return {
      key: mission.key,
      type: mission.type,
      name: mission.title,
      description: mission.description,
      icon: mission.icon,
      currentProgress,
      targetCount: mission.requirement,
      rewardPoints: mission.rewardPoints,
      isCompleted,
      completedAt
    };
  });

  if (updated) {
    progress.missions = merged;
    await progress.save();
  }

  return {
    missions: merged,
    totalPointsEarned: progress.totalPointsEarned || 0,
    lastUpdate: new Date()
  };
};

UserDailyProgress.incrementProgress = async (userId, missionType, incrementBy = 1) => {
  if (!userId || !missionType) return null;

  const today = new Date().toISOString().slice(0, 10);
  const [progress] = await UserDailyProgress.findOrCreate({
    where: { userId, date: today },
    defaults: { missions: [], totalPointsEarned: 0 }
  });

  const dailyMissions = await DailyMission.findAll({ where: { isActive: true } });
  if (!dailyMissions.length) return null;

  const storedMissions = Array.isArray(progress.missions) ? progress.missions : [];
  const storedMap = new Map(storedMissions.map(m => [m.key || m.type, m]));

  const merged = dailyMissions.map(mission => {
    const key = mission.key || mission.type;
    const existing = storedMap.get(key);
    const currentProgress = existing?.currentProgress ?? 0;
    const isCompleted = existing?.isCompleted ?? false;
    const completedAt = existing?.completedAt ?? null;

    return {
      key: mission.key,
      type: mission.type,
      name: mission.title,
      description: mission.description,
      icon: mission.icon,
      currentProgress,
      targetCount: mission.requirement,
      rewardPoints: mission.rewardPoints,
      isCompleted,
      completedAt
    };
  });

  let pointsEarned = progress.totalPointsEarned || 0;
  for (const mission of merged) {
    if (mission.type !== missionType) continue;
    if (mission.isCompleted) continue;

    mission.currentProgress += incrementBy;
    if (mission.currentProgress >= mission.targetCount) {
      mission.isCompleted = true;
      mission.completedAt = new Date();
      pointsEarned += mission.rewardPoints;
    }
  }

  progress.missions = merged;
  progress.totalPointsEarned = pointsEarned;
  await progress.save();

  return progress;
};
