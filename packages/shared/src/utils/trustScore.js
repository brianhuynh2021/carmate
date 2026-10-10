// TRUST & REPUTATION SCORE COMPUTATION ENGINE (TRUST & REPUTATION ENGINE)
// Strictly follows MIT mathematical invariants & Stanford ergonomics

import { DEFAULT_TRUST_RULES, TRUST_TIERS } from '../constants/trustRules.js';

/**
 * Get trust tier information by score
 * @param {number} score 
 * @returns {object} Tier info (label, badgeColor, description)
 */
function getTrustLevel(score) {
  const normalized = Math.max(0, Math.min(100, Math.round(score || 0)));
  const tier = TRUST_TIERS.find((t) => normalized >= t.min && normalized <= t.max);
  return tier || TRUST_TIERS[0];
}

/**
 * Compute the user's detailed trust score
 * @param {object} user Member info (avatar, isCccdVerified, isGplxVerified, role,...)
 * @param {object} [vehicle] Vehicle info if a driver (plate, photos, hasVerifiedPhotos)
 * @param {object} [history] Activity history (completedTrips, rating, lateReports, cancelReports, mismatchReports)
 * @param {Array} [rules] List of rules to apply (if null, DEFAULT_TRUST_RULES is used)
 * @returns {object} Detailed scoring result, checklist of met/unmet criteria, score-cap warnings
 */
export function computeTrustScore(user = {}, vehicle = null, history = {}, rules = null) {
  const activeRules = Array.isArray(rules) && rules.length > 0 ? rules : DEFAULT_TRUST_RULES;
  const isDriver = user?.role === 'driver' || Boolean(vehicle);
  const userRole = isDriver ? 'driver' : 'passenger';

  const hasAvatar = Boolean(user?.avatar && String(user.avatar).trim().length > 10);
  const isCccdVerified = Boolean(user?.isCccdVerified);
  const isGplxVerified = Boolean(user?.isGplxVerified);
  const hasVehiclePlate = Boolean(vehicle?.plate && String(vehicle.plate).trim().length >= 5);
  const hasVehiclePhotos = Boolean(
    vehicle?.hasVerifiedPhotos || (Array.isArray(vehicle?.photos) && vehicle.photos.length >= 3)
  );

  const completedTrips = Number(history?.completedTrips || user?.completedTrips || 0);
  const rating = Number(history?.rating || user?.rating || 5.0);
  const lateReports = Number(history?.lateReports || 0);
  const cancelReports = Number(history?.cancelReports || 0);
  const mismatchReports = Number(history?.mismatchReports || 0);

  let rawScore = 0;
  const earnedCriteria = [];
  const pendingCriteria = [];
  const penalties = [];

  // Filter the rules that are enabled and fit the role
  const applicableRules = activeRules.filter(
    (r) => r.enabled && (r.role === 'all' || r.role === userRole)
  );

  // 1. Base starting score
  const baseRule = applicableRules.find((r) => r.type === 'base') || { points: 50 };
  rawScore += baseRule.points || 50;
  earnedCriteria.push({
    id: 'verified_phone',
    title: baseRule.title || 'Xác thực số điện thoại OTP',
    points: baseRule.points || 50,
    category: 'identity'
  });

  // 2. Profile photo (avatar) score
  const avatarRule = applicableRules.find((r) => r.id === 'avatar_photo');
  if (avatarRule) {
    if (hasAvatar) {
      rawScore += avatarRule.points || 5;
      earnedCriteria.push({
        id: avatarRule.id,
        title: avatarRule.title,
        points: avatarRule.points,
        category: avatarRule.category
      });
    } else {
      pendingCriteria.push({
        id: avatarRule.id,
        title: avatarRule.title,
        description: avatarRule.description,
        points: avatarRule.points,
        actionType: 'upload_avatar',
        actionLabel: 'Tải ảnh đại diện (+5đ & Mở khóa trần 65đ)'
      });
    }
  }

  // 2b. Gender transparency
  const hasGender = Boolean(user?.gender && ['male', 'female', 'other'].includes(user.gender));
  const genderRule = applicableRules.find((r) => r.id === 'profile_gender');
  if (genderRule) {
    if (hasGender) {
      rawScore += genderRule.points || 3;
      earnedCriteria.push({
        id: genderRule.id,
        title: genderRule.title,
        points: genderRule.points,
        category: genderRule.category
      });
    } else {
      pendingCriteria.push({
        id: genderRule.id,
        title: genderRule.title,
        description: genderRule.description,
        points: genderRule.points,
        actionType: 'update_gender',
        actionLabel: 'Cập nhật giới tính (+3đ)'
      });
    }
  }

  // 3. CCCD / VNeID
  const cccdRule = applicableRules.find((r) => r.id === 'cccd_verified');
  if (cccdRule) {
    if (isCccdVerified) {
      rawScore += cccdRule.points || 15;
      earnedCriteria.push({
        id: cccdRule.id,
        title: cccdRule.title,
        points: cccdRule.points,
        category: cccdRule.category
      });
    } else {
      pendingCriteria.push({
        id: cccdRule.id,
        title: cccdRule.title,
        description: cccdRule.description,
        points: cccdRule.points,
        actionType: 'verify_cccd',
        actionLabel: 'Xác thực CCCD (+15đ)'
      });
    }
  }

  // 4. GPLX (driver's license) (drivers only)
  const gplxRule = applicableRules.find((r) => r.id === 'gplx_verified');
  if (gplxRule && isDriver) {
    if (isGplxVerified) {
      rawScore += gplxRule.points || 10;
      earnedCriteria.push({
        id: gplxRule.id,
        title: gplxRule.title,
        points: gplxRule.points,
        category: gplxRule.category
      });
    } else {
      pendingCriteria.push({
        id: gplxRule.id,
        title: gplxRule.title,
        description: gplxRule.description,
        points: gplxRule.points,
        actionType: 'verify_gplx',
        actionLabel: 'Xác minh GPLX B2/C1 (+10đ)'
      });
    }
  }

  // 5. Vehicle registration & license plate (drivers only)
  const vehicleRule = applicableRules.find((r) => r.id === 'vehicle_verified');
  if (vehicleRule && isDriver) {
    if (hasVehiclePlate) {
      rawScore += vehicleRule.points || 10;
      earnedCriteria.push({
        id: vehicleRule.id,
        title: vehicleRule.title,
        points: vehicleRule.points,
        category: vehicleRule.category
      });
    } else {
      pendingCriteria.push({
        id: vehicleRule.id,
        title: vehicleRule.title,
        description: vehicleRule.description,
        points: vehicleRule.points,
        actionType: 'register_vehicle',
        actionLabel: 'Khai báo biển số xe (+10đ)'
      });
    }
  }

  // 6. Real photos of the vehicle (drivers only)
  const photosRule = applicableRules.find((r) => r.id === 'vehicle_photos');
  if (photosRule && isDriver) {
    if (hasVehiclePhotos) {
      rawScore += photosRule.points || 5;
      earnedCriteria.push({
        id: photosRule.id,
        title: photosRule.title,
        points: photosRule.points,
        category: photosRule.category
      });
    } else {
      pendingCriteria.push({
        id: photosRule.id,
        title: photosRule.title,
        description: photosRule.description,
        points: photosRule.points,
        actionType: 'upload_vehicle_photos',
        actionLabel: 'Tải 3 ảnh xe thực tế (+5đ)'
      });
    }
  }

  // 7. Accumulated safe trips
  const tripsRule = applicableRules.find((r) => r.id === 'safe_trips_history');
  if (tripsRule) {
    const ptsPerTrip = tripsRule.points || 2;
    const maxAccum = tripsRule.maxAccumulated || 15;
    const accumulated = Math.min(maxAccum, completedTrips * ptsPerTrip);
    if (accumulated > 0) {
      rawScore += accumulated;
      earnedCriteria.push({
        id: tripsRule.id,
        title: `${tripsRule.title} (${completedTrips} chuyến)`,
        points: accumulated,
        category: tripsRule.category
      });
    } else {
      pendingCriteria.push({
        id: tripsRule.id,
        title: tripsRule.title,
        description: `Tích lũy ${ptsPerTrip}đ mỗi chuyến an toàn hoàn tất (tối đa +${maxAccum}đ)`,
        points: maxAccum,
        actionType: 'complete_trip',
        actionLabel: 'Thực hiện chuyến an toàn (+2đ/chuyến)'
      });
    }
  }

  // 8. High community rating
  const ratingRule = applicableRules.find((r) => r.id === 'high_rating');
  if (ratingRule) {
    if (rating >= 4.8 && completedTrips >= 1) {
      rawScore += ratingRule.points || 5;
      earnedCriteria.push({
        id: ratingRule.id,
        title: `${ratingRule.title} (${rating.toFixed(1)}★)`,
        points: ratingRule.points || 5,
        category: ratingRule.category
      });
    }
  }

  // 9. Punctuality for passengers
  const punctualRule = applicableRules.find((r) => r.id === 'passenger_punctual');
  if (punctualRule && !isDriver) {
    if (completedTrips >= 1 && lateReports === 0) {
      rawScore += punctualRule.points || 10;
      earnedCriteria.push({
        id: punctualRule.id,
        title: punctualRule.title,
        points: punctualRule.points || 10,
        category: punctualRule.category
      });
    } else if (completedTrips === 0) {
      pendingCriteria.push({
        id: punctualRule.id,
        title: punctualRule.title,
        description: punctualRule.description,
        points: punctualRule.points,
        actionType: 'be_punctual',
        actionLabel: 'Tham gia chuyến đi đúng giờ (+10đ)'
      });
    }
  }

  // 10. Custom criteria (Custom Rules added by the Admin)
  const customAddRules = applicableRules.filter(
    (r) =>
      !['verified_phone', 'avatar_photo', 'no_avatar_cap', 'cccd_verified', 'gplx_verified', 'vehicle_verified', 'vehicle_photos', 'safe_trips_history', 'high_rating', 'passenger_punctual', 'penalty_late', 'penalty_cancel', 'penalty_mismatch'].includes(r.id) &&
      r.type === 'add'
  );
  for (const cr of customAddRules) {
    // If the user payload has a flag marking this criterion (e.g. user.customBadges?.includes(cr.id))
    if (user?.customBadges?.includes?.(cr.id) || user?.[cr.id]) {
      rawScore += cr.points || 0;
      earnedCriteria.push({
        id: cr.id,
        title: cr.title,
        points: cr.points,
        category: cr.category || 'custom'
      });
    } else {
      pendingCriteria.push({
        id: cr.id,
        title: cr.title,
        description: cr.description,
        points: cr.points,
        actionType: 'custom_action',
        actionLabel: `${cr.title} (+${cr.points}đ)`
      });
    }
  }

  // 11. Point deductions / Penalties (Penalties)
  if (lateReports > 0) {
    const lateRule = applicableRules.find((r) => r.id === 'penalty_late') || { points: -10 };
    const penaltyVal = Math.abs(lateRule.points || 10) * lateReports;
    rawScore -= penaltyVal;
    penalties.push({
      id: 'penalty_late',
      title: `Trễ hẹn (${lateReports} lần)`,
      points: -penaltyVal
    });
  }

  if (cancelReports > 0) {
    const cancelRule = applicableRules.find((r) => r.id === 'penalty_cancel') || { points: -15 };
    const penaltyVal = Math.abs(cancelRule.points || 15) * cancelReports;
    rawScore -= penaltyVal;
    penalties.push({
      id: 'penalty_cancel',
      title: `Hủy chuyến sát giờ (${cancelReports} lần)`,
      points: -penaltyVal
    });
  }

  if (mismatchReports > 0 && isDriver) {
    const mismatchRule = applicableRules.find((r) => r.id === 'penalty_mismatch') || { points: -20 };
    const penaltyVal = Math.abs(mismatchRule.points || 20) * mismatchReports;
    rawScore -= penaltyVal;
    penalties.push({
      id: 'penalty_mismatch',
      title: `Báo cáo xe không khớp (${mismatchReports} lần)`,
      points: -penaltyVal
    });
  }

  // 12. MATHEMATICAL INVARIANTS (MIT INVARIANTS):
  // Score before applying the cap
  const boundedRawScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Score-cap invariant when the profile photo is missing (Missing Avatar Cap Invariant)
  const capRule = activeRules.find((r) => r.id === 'no_avatar_cap' && r.enabled);
  const capLimit = capRule ? Number(capRule.points || 65) : 100;
  let isCapApplied = false;
  let finalScore = boundedRawScore;

  if (!hasAvatar && boundedRawScore > capLimit) {
    finalScore = capLimit;
    isCapApplied = true;
  }

  const level = getTrustLevel(finalScore);

  return {
    score: finalScore,
    rawScore: boundedRawScore,
    isCapApplied,
    capLimit,
    hasAvatar,
    level,
    userRole,
    isDriver,
    earnedCriteria,
    pendingCriteria,
    penalties,
    // Suggestion for the quickest action to raise the score
    nextBestAction: pendingCriteria[0] || null
  };
}
