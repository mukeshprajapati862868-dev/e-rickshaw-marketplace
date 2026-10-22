const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');

/**
 * List notifications for logged-in user
 */
const list = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({
    success: true,
    data: notifications,
  });
});

/**
 * Mark one notification as read
 */
const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  res.json({
    success: true,
    data: notification,
  });
});

/**
 * Mark all as read
 */
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  res.json({
    success: true,
    message: 'All notifications marked as read',
  });
});

/**
 * Helper – create notification (use from other controllers)
 */
const createNotification = async ({
  userId,
  title,
  body,
  type,
  data = {},
  channels = { inApp: true, push: false, email: false },
}) => {
  if (!userId || !title || !body || !type) return null;

  const notification = await Notification.create({
    user: userId,
    title,
    body,
    type,
    data,
    channels,
  });

  return notification;
};

module.exports = {
  list,
  markRead,
  markAllRead,
  createNotification,
};