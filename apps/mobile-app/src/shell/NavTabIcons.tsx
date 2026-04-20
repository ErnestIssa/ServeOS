import React from "react";
import Svg, { G, Path } from "react-native-svg";

type IconProps = {
  size?: number;
  color: string;
};

/** home-1-svgrepo-com.svg */
export function NavIconHome({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0L0 6V8H1V15H4V10H7V15H15V8H16V6L14 4.5V1H11V2.25L8 0ZM9 10H12V13H9V10Z"
      />
    </Svg>
  );
}

/** bookings-svgrepo-com.svg */
export function NavIconBookings({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Scale up — glyph sat smaller in viewBox than other tab marks */}
      <G transform="translate(50 50) scale(1.2) translate(-50 -50)">
        <Path
          fill={color}
          d="M78.8,62.1l-3.6-1.7c-0.5-0.3-1.2-0.3-1.7,0L52,70.6c-1.2,0.6-2.7,0.6-3.9,0L26.5,60.4c-0.5-0.3-1.2-0.3-1.7,0l-3.6,1.7c-1.6,0.8-1.6,2.9,0,3.7L48,78.5c1.2,0.6,2.7,0.6,3.9,0l26.8-12.7C80.4,65,80.4,62.8,78.8,62.1z"
        />
        <Path
          fill={color}
          d="M78.8,48.1l-3.7-1.7c-0.5-0.3-1.2-0.3-1.7,0L52,56.6c-1.2,0.6-2.7,0.6-3.9,0L26.6,46.4c-0.5-0.3-1.2-0.3-1.7,0l-3.7,1.7c-1.6,0.8-1.6,2.9,0,3.7L48,64.6c1.2,0.6,2.7,0.6,3.9,0l26.8-12.7C80.4,51.1,80.4,48.9,78.8,48.1z"
        />
        <Path
          fill={color}
          d="M21.2,37.8l26.8,12.7c1.2,0.6,2.7,0.6,3.9,0l26.8-12.7c1.6-0.8,1.6-2.9,0-3.7L51.9,21.4c-1.2-0.6-2.7-0.6-3.9,0L21.2,34.2C19.6,34.9,19.6,37.1,21.2,37.8z"
        />
      </G>
    </Svg>
  );
}

/** ForkKnifeCircleIcon — same “O” mark as ServeOS loading wordmark */
export function NavIconOrdersMark({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 380.721 380.721">
      <Path
        fill={color}
        d="M190.372,29.813c-88.673,0-160.546,71.873-160.546,160.547c0,65.89,39.73,122.438,96.504,147.173l2.092-40.525 c0-32.242-23.83-21.912-23.83-44.465c0-12.641,0.395-38.98,0.395-58.755c0-52.697,22.377-103.673,27.874-115.048 c5.53-11.363,18.537-23.76,18.677-11.828c0,17.312,0.738,218.618,0.738,218.618h-0.035l2.463,61.241 c11.497,2.626,23.395,4.125,35.669,4.125c6.728,0,13.304-0.546,19.822-1.349l5.31-102.906 c-13.106-2.869-24.283-11.212-31.295-21.68c-8.685-13.014,6.675-128.067,6.675-128.067h10.004v107.978h9.922V96.894h10.84v107.978 h9.889V96.894h11.258v107.978h9.911V96.894h7.668c0,0,15.349,115.054,6.669,128.067c-6.947,10.363-18.009,18.682-30.952,21.633 c-0.232,0.07-0.441,0.163-0.441,0.163l5.02,95.993c63.995-21.11,110.249-81.307,110.249-152.39 C350.907,101.687,279.034,29.813,190.372,29.813z"
      />
      <Path
        fill={color}
        d="M190.372,0C85.415,0,0,85.397,0,190.36C0,295.3,85.415,380.721,190.372,380.721c104.952,0,190.35-85.421,190.35-190.361 C380.721,85.397,295.324,0,190.372,0z M190.372,366.523c-97.144,0-176.18-79.03-176.18-176.163 c0-97.144,79.036-176.18,176.18-176.18c97.133,0,176.175,79.036,176.175,176.18C366.546,287.493,287.504,366.523,190.372,366.523z"
      />
    </Svg>
  );
}

/** messages-f-svgrepo-com.svg */
export function NavIconMessages({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="-2 -2.5 24 24">
      <Path
        fill={color}
        d="M3.656 17.979A1 1 0 0 1 2 17.243V15a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8.003l-4.347 2.979zM16 10.017a7.136 7.136 0 0 0 0 .369v-.37c.005-.107.006-1.447.004-4.019a3 3 0 0 0-3-2.997H5V2a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2v2.243a1 1 0 0 1-1.656.736L16 13.743v-3.726z"
      />
    </Svg>
  );
}

/** account-svgrepo-com.svg */
export function NavIconAccount({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.5 7.063C16.5 10.258 14.57 13 12 13c-2.572 0-4.5-2.742-4.5-5.938C7.5 3.868 9.16 2 12 2s4.5 1.867 4.5 5.063zM4.102 20.142C4.487 20.6 6.145 22 12 22c5.855 0 7.512-1.4 7.898-1.857a.416.416 0 0 0 .09-.317C19.9 18.944 19.106 15 12 15s-7.9 3.944-7.989 4.826a.416.416 0 0 0 .091.317z"
      />
    </Svg>
  );
}
