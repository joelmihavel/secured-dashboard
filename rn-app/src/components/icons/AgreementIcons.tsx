import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

export const AgreementIdIcon: React.FC<IconProps> = ({ size = 12, color = '#A6A6A6' }) => (
  <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={size} height={size} viewBox="0 0 11 12" fill="none">
      <Path
        d="M2.52285 7.33333L2.80313 4.66667H0V3.33333H2.94327L3.29362 0H4.63427L4.28393 3.33333H6.94327L7.2936 0H8.63427L8.28393 3.33333H10.6667V4.66667H8.1438L7.86353 7.33333H10.6667V8.66667H7.7234L7.37307 12H6.0324L6.38273 8.66667H3.72339L3.37305 12H2.03237L2.38271 8.66667H0V7.33333H2.52285ZM3.86353 7.33333H6.52287L6.80313 4.66667H4.1438L3.86353 7.33333Z"
        fill={color}
      />
    </Svg>
  </View>
);

export const PropertyIcon: React.FC<IconProps> = ({ size = 12, color = '#A6A6A6' }) => (
  <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={(size / 12) * 15} height={size} viewBox="0 0 15 12" fill="none">
      <Path
        d="M13.3333 10.6667H14.6667V12H0V10.6667H1.33333V0.666667C1.33333 0.29848 1.63181 0 2 0H8.66667C9.03487 0 9.33333 0.29848 9.33333 0.666667V10.6667H12V5.33333H10.6667V4H12.6667C13.0349 4 13.3333 4.29848 13.3333 4.66667V10.6667ZM2.66667 1.33333V10.6667H8V1.33333H2.66667ZM4 5.33333H6.66667V6.66667H4V5.33333ZM4 2.66667H6.66667V4H4V2.66667Z"
        fill={color}
      />
    </Svg>
  </View>
);

export const TenantIcon: React.FC<IconProps> = ({ size = 14, color = '#A6A6A6' }) => (
  <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={(size / 14) * 11} height={size} viewBox="0 0 11 14" fill="none">
      <Path
        d="M0 14C0 11.0545 2.38781 8.66667 5.33333 8.66667C8.27887 8.66667 10.6667 11.0545 10.6667 14H9.33333C9.33333 11.7909 7.54247 10 5.33333 10C3.12419 10 1.33333 11.7909 1.33333 14H0ZM5.33333 8C3.12333 8 1.33333 6.21 1.33333 4C1.33333 1.79 3.12333 0 5.33333 0C7.54333 0 9.33333 1.79 9.33333 4C9.33333 6.21 7.54333 8 5.33333 8ZM5.33333 6.66667C6.80667 6.66667 8 5.47333 8 4C8 2.52667 6.80667 1.33333 5.33333 1.33333C3.86 1.33333 2.66667 2.52667 2.66667 4C2.66667 5.47333 3.86 6.66667 5.33333 6.66667Z"
        fill={color}
      />
    </Svg>
  </View>
);

export const LandlordIcon: React.FC<IconProps> = ({ size = 14, color = '#A6A6A6' }) => (
  <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={(size / 14) * 12} height={size} viewBox="0 0 12 14" fill="none">
      <Path
        d="M5.33333 8.66667V10C3.12419 10 1.33333 11.7909 1.33333 14H0C0 11.0545 2.38781 8.66667 5.33333 8.66667ZM5.33333 8C3.12333 8 1.33333 6.21 1.33333 4C1.33333 1.79 3.12333 0 5.33333 0C7.54333 0 9.33333 1.79 9.33333 4C9.33333 6.21 7.54333 8 5.33333 8ZM5.33333 6.66667C6.80667 6.66667 8 5.47333 8 4C8 2.52667 6.80667 1.33333 5.33333 1.33333C3.86 1.33333 2.66667 2.52667 2.66667 4C2.66667 5.47333 3.86 6.66667 5.33333 6.66667ZM11.3333 10.6667H12V14H6.66667V10.6667H7.33333V10C7.33333 8.8954 8.22873 8 9.33333 8C10.4379 8 11.3333 8.8954 11.3333 10V10.6667ZM10 10.6667V10C10 9.6318 9.70153 9.33333 9.33333 9.33333C8.96513 9.33333 8.66667 9.6318 8.66667 10V10.6667H10Z"
        fill={color}
      />
    </Svg>
  </View>
);

export const FlentLogoIcon: React.FC<IconProps> = ({ size = 39, color = '#FFFFFF' }) => (
  <Svg width={(size / 39) * 33} height={size} viewBox="0 0 33 39" fill="none">
    <Path
      d="M12.1633 39H3.63315V20.6761H0V15.6212H3.63315C1.6112 7.78612 7.319 3.08934 10.4256 1.72034C19.5244 -3.08179 28.9602 3.29996 32.5407 7.0911V39H24.0106V11.3562C19.0821 3.26835 12.9004 5.14287 10.4256 7.0911C7.26635 12.5251 11.742 15.042 14.3748 15.6212H18.7978V20.6761H12.1633V39Z"
      fill={color}
    />
  </Svg>
);
