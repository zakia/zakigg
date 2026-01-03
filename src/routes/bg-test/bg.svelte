<svg
	width="1920"
	height="2812"
	viewBox="0 0 1920 2812"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class="absolute inset-0"
	{...$$props}
>
	<defs>
		<!-- 
            Simplified Blur Filter:
            - Uses objectBoundingBox (default) so coordinates are relative to the shape
            - Expands filter region (-50% to 200%) to prevent clipping the wide blur
        -->
		<filter id="blur-heavy" x="-50%" y="-50%" width="200%" height="200%">
			<feGaussianBlur stdDeviation="350" />
		</filter>

		<!-- 
            Gradients:
            - Kept userSpaceOnUse because these coordinates are specific pixel locations 
              on the 1920x2812 canvas. 
            - If we switched to objectBoundingBox, we'd need to convert these huge numbers 
              to 0-1 percentages based on each shape's bounding box, which is complex/error-prone 
              without the original design file.
        -->
		<linearGradient
			id="gradient-right"
			x1="727.221"
			y1="1122.41"
			x2="2091.06"
			y2="1829.65"
			gradientUnits="userSpaceOnUse"
		>
			<stop stop-color="#000DFF" />
			<stop offset="0.541798" stop-color="#5856D6" />
			<stop offset="1" stop-color="#99F3FF" />
		</linearGradient>

		<linearGradient
			id="gradient-left"
			x1="1192.71"
			y1="1689.59"
			x2="-171.127"
			y2="982.351"
			gradientUnits="userSpaceOnUse"
		>
			<stop stop-color="#000DFF" />
			<stop offset="0.541798" stop-color="#5856D6" />
			<stop offset="1" stop-color="#99F3FF" />
		</linearGradient>
	</defs>

	<g opacity="0.73">
		<!-- Right Shape -->
		<g filter="url(#blur-heavy)">
			<path
				d="M1887.25 1120.35C2016.69 1206.18 2102.33 1316.73 2132.15 1436.48C2161.97 1556.24 2134.47 1679.17 2053.51 1788.03C1972.54 1896.89 1842.19 1986.2 1680.75 2043.41C1519.31 2100.63 1334.9 2122.88 1153.41 2107.03C971.928 2091.19 802.484 2038.05 668.881 1955.08C535.277 1872.11 444.225 1763.48 408.513 1644.44C372.802 1525.39 394.224 1401.93 469.771 1291.37C545.318 1180.81 671.195 1088.73 829.723 1028.04L1036.51 1265.52C952.818 1297.56 886.364 1346.18 846.48 1404.54C806.597 1462.91 795.287 1528.09 814.141 1590.94C832.994 1653.78 881.063 1711.14 951.596 1754.94C1022.13 1798.74 1111.58 1826.79 1207.4 1835.16C1303.21 1843.52 1400.57 1831.78 1485.79 1801.57C1571.02 1771.36 1639.84 1724.22 1682.58 1666.75C1725.32 1609.28 1739.84 1544.37 1724.1 1481.15C1708.36 1417.93 1663.15 1359.57 1594.81 1314.26L1887.25 1120.35Z"
				fill="url(#gradient-right)"
			/>
		</g>

		<!-- Left Shape -->
		<g filter="url(#blur-heavy)">
			<path
				d="M32.6757 1691.65C-96.7622 1605.82 -182.404 1495.27 -212.223 1375.52C-242.041 1255.77 -214.538 1132.83 -133.576 1023.97C-52.6138 915.115 77.7401 825.807 239.178 768.592C400.616 711.376 585.028 689.128 766.515 704.97C948.002 720.813 1117.45 773.951 1251.05 856.921C1384.65 939.891 1475.7 1048.53 1511.42 1167.57C1547.13 1286.61 1525.71 1410.08 1450.16 1520.63C1374.61 1631.19 1248.73 1723.28 1090.21 1783.96L883.42 1546.48C967.111 1514.44 1033.57 1465.83 1073.45 1407.46C1113.33 1349.09 1124.64 1283.91 1105.79 1221.07C1086.94 1158.22 1038.87 1100.87 968.333 1057.07C897.8 1013.26 808.345 985.21 712.533 976.846C616.721 968.483 519.364 980.228 434.135 1010.43C348.907 1040.64 280.09 1087.79 237.347 1145.26C194.605 1202.73 180.085 1267.63 195.827 1330.85C211.569 1394.07 256.782 1452.44 325.116 1497.74L32.6757 1691.65Z"
				fill="url(#gradient-left)"
			/>
		</g>
	</g>
</svg>
