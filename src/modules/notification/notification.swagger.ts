import { ApiDoc } from '../../common/lib/swagger';

export const TriggerReminderDoc = () =>
  ApiDoc({
    summary: 'Trigger upcoming appointment reminder (cron endpoint)',
  });

export const SetFCMDoc = () =>
  ApiDoc({
    summary: 'Set FCM token for the authenticated user',
    auth: true,
  });

export const SendNotificationDoc = () =>
  ApiDoc({
    summary: 'Send a push notification to specific FCM tokens',
    auth: true,
  });

export const GetNotificationHistoryDoc = () =>
  ApiDoc({
    summary: 'Get notification history for the authenticated user',
    auth: true,
  });
