import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import './VoucherPrint.css';

const formatCurrency = (val) => `$${parseFloat(val || 0).toFixed(2)}`;

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('T')[0].split('-');
  return `${m}/${d}/${y}`;
};

function VoucherPrint() {
  const { id } = useParams(); // changed from lineId to id to match Route
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Automatically trigger print popup after data loads
    if (!loading && data) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, data]);

  useEffect(() => {
    const fetchLine = async () => {
      try {
        const res = await api.get(`/payroll/lines/${id}`);
        setData(res.data?.data || res.data);
      } catch (e) {
        console.error("Voucher fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLine();
  }, [id, api]);

  if (loading) return <div style={{ padding: 40}}>Loading voucher...</div>;
  if (!data) return <div style={{ padding: 40}}>Voucher not found</div>;

  const w = data.worker || {};
  const payroll = data.payroll || {};

  return (
    <div className="voucher-print-container">
      {/* HEADER */}
      <div className="v-header">
        <div className="v-header-left">
          <h1>PAYROLL VOUCHER</h1>
          <div className="v-company-name">HM Construction Staffing LLLP</div>
          <div className="v-company-lines">
            786-815-5660 | 786-538-4229<br />
            10405 NW 27th Ave, Miami, FL 33147<br />
            hmcs@hmconstructionlllp.com
          </div>
        </div>
        <div className="v-header-right">
           <img src="/imagen/logo_cuadrado.jpg" alt="HM Construction Staffing LLLP" className="v-logo" />
        </div>
      </div>

      <div className="v-flex-row v-meta-info">
        <div className="v-meta-box">
          <div className="vm-label">Worker Name</div>
          <div className="vm-value">{w.first_name} {w.last_name}</div>
        </div>
        <div className="v-meta-box">
          <div className="vm-label">Worker ID</div>
          <div className="vm-value">{w.worker_code}</div>
        </div>
        <div className="v-meta-box">
          <div className="vm-label">Pay Period</div>
          <div className="vm-value">{formatDate(payroll.week_start_date)} - {formatDate(payroll.week_end_date)}</div>
        </div>
        <div className="v-meta-box">
          <div className="vm-label">Reference / Method</div>
          <div className="vm-value">
              {data.payment_method?.toUpperCase()} 
              {data.payment_reference ? ` - ${data.payment_reference}` : ''}
          </div>
        </div>
      </div>

      <div className="v-divider"></div>

      <div className="v-earnings-section">
        <h3>EARNINGS</h3>
        <table className="v-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="t-right">Hours</th>
              <th className="t-right">Rate</th>
              <th className="t-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Regular Time</td>
              <td className="t-right">{parseFloat(data.regular_hours).toFixed(1)}</td>
              <td className="t-right">{formatCurrency(data.regular_rate)}</td>
              <td className="t-right">{formatCurrency(data.regular_pay)}</td>
            </tr>
            {parseFloat(data.overtime_hours || 0) > 0 && (
              <tr>
                <td>Overtime (1.5x)</td>
                <td className="t-right">{parseFloat(data.overtime_hours).toFixed(1)}</td>
                <td className="t-right">{formatCurrency(data.overtime_rate)}</td>
                <td className="t-right">{formatCurrency(data.overtime_pay)}</td>
              </tr>
            )}
             {parseFloat(data.per_diem_amount || 0) > 0 && (
               <tr className="v-per-diem-row">
                 <td>Per Diem (Non-Taxable Reimbursement)</td>
                 <td className="t-right">—</td>
                 <td className="t-right">—</td>
                 <td className="t-right">{formatCurrency(data.per_diem_amount)}</td>
               </tr>
             )}
          </tbody>
        </table>
      </div>

      <div className="v-divider"></div>

      <div className="v-totals-section">
        <div className="v-totals-row">
           <span>Gross Labor</span>
           <span>{formatCurrency(data.gross_pay)}</span>
        </div>
        {parseFloat(data.per_diem_amount || 0) > 0 && (
          <div className="v-totals-row">
            <span>Per Diem</span>
            <span>{formatCurrency(data.per_diem_amount)}</span>
          </div>
        )}
        <div className="v-totals-row v-net-pay">
           <span>NET TRANSFER</span>
           <span>{formatCurrency(data.total_to_transfer)}</span>
        </div>
      </div>

      <div className="v-footer">
        <p>This document serves as proof of payment from HM Construction Staffing LLLP.</p>
        <p>Status: {data.status?.toUpperCase()} | Paid at: {formatDate(data.paid_at)}</p>
      </div>

    </div>
  );
}

export default VoucherPrint;
