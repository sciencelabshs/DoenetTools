import React, { Suspense } from 'react';
import { useRecoilValue } from 'recoil';
import { BreadCrumb } from '../../../_reactComponents/PanelHeaderComponents/BreadCrumb';
import { searchParamAtomFamily } from '../NewToolRoot';
import { useCourseChooserCrumb, useDashboardCrumb, useEnrollmentCrumb } from '../../../_utils/breadcrumbUtil';

export default function EnrollmentBreadCrumb() {
  const driveId = useRecoilValue(searchParamAtomFamily('driveId'));
  const courseChooserCrumb = useCourseChooserCrumb();
  const dashboardCrumb = useDashboardCrumb(driveId);
  const enrollmentCrumb = useEnrollmentCrumb(driveId);
  return (
    <Suspense fallback={<div>loading Breadcrumbs...</div>}>
      <BreadCrumb crumbs={[courseChooserCrumb,dashboardCrumb,enrollmentCrumb]}/>
    </Suspense>
  );
}
