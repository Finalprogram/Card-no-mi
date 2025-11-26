const mongoose = require('mongoose');

const DailyMissionSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: 'fa-trophy'
  },
  type: {
    type: String,
    enum: ['create_thread', 'create_post', 'give_reaction', 'receive_reaction', 'upvote', 'login'],
    required: true
  },
  requirement: {
    type: Number,
    required: true
  },
  rewardPoints: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const UserDailyProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  missions: [{
    mission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DailyMission'
    },
    progress: {
      type: Number,
      default: 0
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date
    }
  }],
  totalPointsEarned: {
    type: Number,
    default: 0
  }
});

// Índice composto para garantir uma entrada por usuário por dia
UserDailyProgressSchema.index({ user: 1, date: 1 }, { unique: true });

// Método para obter progresso do dia
UserDailyProgressSchema.statics.getTodayProgress = async function(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let progress = await this.findOne({ 
    user: userId, 
    date: today 
  }).populate('missions.mission');
  
  if (!progress) {
    // Criar novo progresso para hoje com todas as missões ativas
    const DailyMission = mongoose.model('DailyMission');
    const activeMissions = await DailyMission.find({ isActive: true });
    
    progress = await this.create({
      user: userId,
      date: today,
      missions: activeMissions.map(m => ({
        mission: m._id,
        progress: 0,
        completed: false
      }))
    });
    
    progress = await progress.populate('missions.mission');
  }
  
  // Formatar dados para a view
  const formattedProgress = {
    lastUpdate: progress.date,
    missions: progress.missions.map(m => ({
      name: m.mission.title,
      description: m.mission.description,
      icon: m.mission.icon,
      currentProgress: m.progress,
      targetCount: m.mission.requirement,
      rewardPoints: m.mission.rewardPoints,
      isCompleted: m.completed,
      completedAt: m.completedAt,
      progressPercentage: Math.min(100, Math.round((m.progress / m.mission.requirement) * 100))
    }))
  };
  
  return formattedProgress;
};

// Método para incrementar progresso de uma missão
UserDailyProgressSchema.statics.incrementProgress = async function(userId, missionType, amount = 1) {
  const progress = await this.getTodayProgress(userId);
  const User = mongoose.model('User');
  
  let pointsEarned = 0;
  
  for (const missionProgress of progress.missions) {
    if (missionProgress.mission.type === missionType && !missionProgress.completed) {
      missionProgress.progress += amount;
      
      // Verificar se completou a missão
      if (missionProgress.progress >= missionProgress.mission.requirement) {
        missionProgress.completed = true;
        missionProgress.completedAt = new Date();
        pointsEarned += missionProgress.mission.rewardPoints;
        progress.totalPointsEarned += missionProgress.mission.rewardPoints;
        
        // Adicionar pontos de facção ao usuário
        await User.findByIdAndUpdate(userId, {
          $inc: { factionPoints: missionProgress.mission.rewardPoints }
        });
      }
    }
  }
  
  await progress.save();
  return { progress, pointsEarned };
};

const DailyMission = mongoose.model('DailyMission', DailyMissionSchema);
const UserDailyProgress = mongoose.model('UserDailyProgress', UserDailyProgressSchema);

module.exports = { DailyMission, UserDailyProgress };
