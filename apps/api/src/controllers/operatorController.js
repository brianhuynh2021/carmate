import {
  listOperators, getPublicOperator, listMyOperators, updateOwnedOperator,
  createOperatorClaim, createOperatorReport, getOperatorReportStatus,
  adminListOperators, adminGetOperator, createOperator, updateOperator, adminListClaims,
  reviewOperatorClaim, adminListReports, reviewOperatorReport
} from '../services/operatorProfiles.js';

function handler(action, successStatus = 200) {
  return function operatorHandler(req, res) {
    try {
      const data = action(req);
      return res.status(successStatus).json({ success: true, data });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      if (status === 500) console.error('[operatorProfiles]', error.message);
      return res.status(status).json({ success: false, error: status === 500 ? 'Chưa xử lý được hồ sơ. Vui lòng thử lại.' : error.message });
    }
  };
}

export const listOperatorsHandler = handler(req => {
  const { q, kind, corridor, limit } = req.query || {};
  return listOperators({ q, kind, corridor, limit });
});
export const getOperatorHandler = handler(req => getPublicOperator(req.params.id));
export const listMyOperatorsHandler = handler(req => listMyOperators(req.user));
export const updateOwnedOperatorHandler = handler(req => updateOwnedOperator(req.params.id, req.body, req.user));
export const createOperatorClaimHandler = handler(req => createOperatorClaim(req.params.id, req.body, req.user), 201);
export const createOperatorReportHandler = handler(req => createOperatorReport(req.params.id, req.body), 201);
export const getOperatorReportStatusHandler = handler(req => getOperatorReportStatus(req.body?.id, req.body?.accessToken));
export const adminListOperatorsHandler = handler(req => adminListOperators(req.query, req.admin));
export const adminGetOperatorHandler = handler(req => adminGetOperator(req.params.id, req.admin));
export const adminCreateOperatorHandler = handler(req => createOperator(req.body, req.admin), 201);
export const adminUpdateOperatorHandler = handler(req => updateOperator(req.params.id, req.body, req.admin));
export const adminListClaimsHandler = handler(req => adminListClaims(req.query, req.admin));
export const adminReviewClaimHandler = handler(req => reviewOperatorClaim(req.params.id, req.body, req.admin));
export const adminListReportsHandler = handler(req => adminListReports(req.query, req.admin));
export const adminReviewReportHandler = handler(req => reviewOperatorReport(req.params.id, req.body, req.admin));
