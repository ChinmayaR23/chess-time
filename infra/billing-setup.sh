#!/bin/bash
# Run locally (with AWS CLI configured) to set up billing alerts.
# Requires: aws cli v2, account ID, and billing alerts enabled in AWS console first.
# Enable billing alerts: AWS Console → Billing → Billing Preferences → Receive Billing Alerts
set -e

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
EMAIL="chinmayarayee@gmail.com"
REGION="eu-north-1"

echo "==> Account: $ACCOUNT_ID"
echo "==> Setting up billing controls..."

# --- SNS topic for alerts ---
echo "==> Creating SNS topic for billing alerts"
SNS_ARN=$(aws sns create-topic --name chess-time-billing-alerts \
  --region us-east-1 \
  --query TopicArn --output text)

aws sns subscribe \
  --topic-arn "$SNS_ARN" \
  --protocol email \
  --notification-endpoint "$EMAIL" \
  --region us-east-1

echo "    SNS topic: $SNS_ARN"
echo "    CHECK YOUR EMAIL and confirm the subscription before alerts work!"

# --- CloudWatch billing alarm (must be us-east-1) ---
echo "==> Creating CloudWatch billing alarm (\$40 threshold)"
aws cloudwatch put-metric-alarm \
  --alarm-name "chess-time-monthly-billing-40" \
  --alarm-description "Chess Time monthly bill exceeded \$40" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 40 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=Currency,Value=USD \
  --evaluation-periods 1 \
  --alarm-actions "$SNS_ARN" \
  --region us-east-1

# --- AWS Budget: monthly $35 cap with 50/80/100% alerts ---
echo "==> Creating monthly budget (\$35)"
aws budgets create-budget \
  --account-id "$ACCOUNT_ID" \
  --budget '{
    "BudgetName": "chess-time-monthly",
    "BudgetLimit": {"Amount": "35", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 50,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "'"$EMAIL"'"}]
    },
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 80,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "'"$EMAIL"'"}]
    },
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 100,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "'"$EMAIL"'"}]
    }
  ]'

# --- Cost Anomaly Detection ---
echo "==> Creating Cost Anomaly Monitor"
MONITOR_ARN=$(aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "chess-time-anomaly-monitor",
    "MonitorType": "DIMENSIONAL",
    "MonitorDimension": "SERVICE"
  }' \
  --query MonitorArn --output text)

aws ce create-anomaly-subscription \
  --anomaly-subscription '{
    "SubscriptionName": "chess-time-anomaly-alert",
    "MonitorArnList": ["'"$MONITOR_ARN"'"],
    "Subscribers": [
      {"Address": "'"$EMAIL"'", "Type": "EMAIL"}
    ],
    "Threshold": 10,
    "Frequency": "IMMEDIATE"
  }'

echo ""
echo "==> Billing setup complete!"
echo "    1. Confirm the SNS email subscription (check $EMAIL)"
echo "    2. Tag all AWS resources: Project=chess-time, Environment=prod"
